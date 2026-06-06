import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { BudgetAgent, agentBackgroundJobsEnabled, agentRuntimeEnabled } from './budget';
import { getAmauraAgentForConsumer } from './registry';
import { hasCompletedAmauraRun } from './idempotency';
import {
  hasAmauraStateVisibleOutcome,
  type AmauraAgentContext,
  type AmauraAgentDefinition,
  type AmauraAgentResult,
} from './types';

type ConsumerResult = {
  status: 'HANDLED' | 'SKIPPED_INTENTIONALLY' | 'SKIPPED_STALE_ROUTE' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE';
  reason?: string;
};

type SupabaseLike = ReturnType<typeof createAdminClient>;

export async function runAmauraConsumerForLease(
  lease: any,
  options: { client?: SupabaseLike } = {}
): Promise<ConsumerResult> {
  const agent = getAmauraAgentForConsumer(String(lease.consumer_name));
  if (!agent) {
    return {
      status: 'SKIPPED_STALE_ROUTE',
      reason: `${lease.consumer_name} is not a native Amaura consumer.`,
    };
  }

  if (!agentRuntimeEnabled() || !agentBackgroundJobsEnabled()) {
    return {
      status: 'SKIPPED_INTENTIONALLY',
      reason: 'Amaura agent runtime is disabled.',
    };
  }

  if (!agent.handledEvents.includes(String(lease.event_type))) {
    return {
      status: 'SKIPPED_STALE_ROUTE',
      reason: `${agent.name} does not handle ${lease.event_type}.`,
    };
  }

  const payload = agent.inputSchema.safeParse(lease.event_payload ?? {});
  if (!payload.success) {
    logger.warn('Amaura agent payload rejected', {
      agentName: agent.name,
      eventId: lease.event_id,
      eventType: lease.event_type,
      issues: payload.error.issues,
    });
    return {
      status: 'SKIPPED_INTENTIONALLY',
      reason: `Invalid ${agent.name} payload.`,
    };
  }

  const context = buildAgentContext(agent, lease, payload.data, options.client);

  try {
    const alreadyRan = await hasCompletedAmauraRun({
      userId: context.userId,
      agentName: agent.name,
      dedupKey: context.idempotencyKey,
      client: options.client,
    });
    if (alreadyRan) {
      return {
        status: 'SKIPPED_INTENTIONALLY',
        reason: `${agent.name} already handled dedup key.`,
      };
    }
  } catch (error) {
    logger.warn('Amaura idempotency lookup failed; failing closed for this agent', {
      agentName: agent.name,
      eventId: context.eventId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: 'RETRYABLE_FAILURE',
      reason: 'Amaura idempotency lookup failed.',
    };
  }

  const runId = await startAmauraRun(agent, context, payload.data, options.client);
  try {
    const rawResult = await agent.run(context, payload.data);
    const parsed = agent.outputSchema.safeParse(rawResult);
    if (!parsed.success) {
      throw new Error(`Invalid ${agent.name} output: ${parsed.error.message}`);
    }
    if (!parsed.data.skipped && !hasAmauraStateVisibleOutcome(parsed.data as AmauraAgentResult)) {
      throw new Error(`${agent.name} completed without a state-visible outcome.`);
    }
    await finishAmauraRun(runId, parsed.data as AmauraAgentResult, options.client);
    return parsed.data.skipped
      ? { status: 'SKIPPED_INTENTIONALLY', reason: parsed.data.skipReason ?? `${agent.name} skipped.` }
      : { status: 'HANDLED' };
  } catch (error) {
    await failAmauraRun(runId, error, options.client).catch((runError) => {
      logger.warn('Amaura run failure update failed', {
        runId,
        error: runError instanceof Error ? runError.message : String(runError),
      });
    });

    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Amaura agent failed', {
      agentName: agent.name,
      eventId: context.eventId,
      eventType: context.eventType,
      error: message,
    });
    return {
      status: agent.retry.retryable ? 'RETRYABLE_FAILURE' : 'PERMANENT_FAILURE',
      reason: message,
    };
  }
}

function buildAgentContext(
  agent: AmauraAgentDefinition<any>,
  lease: any,
  payload: any,
  client?: SupabaseLike
): AmauraAgentContext {
  const now = new Date();
  const budget = new BudgetAgent({
    userId: lease.user_id,
    agentName: agent.name,
    policy: agent.budget,
    client,
  }).createContext();
  const baseContext = {
    userId: lease.user_id,
    goalId: getGoalId(payload),
    eventId: lease.event_id,
    eventType: lease.event_type,
    idempotencyKey: '',
    now,
    logger: {
      info: (message: string, meta?: Record<string, unknown>) => logger.info(message, meta),
      warn: (message: string, meta?: Record<string, unknown>) => logger.warn(message, meta),
      error: (message: string, meta?: Record<string, unknown>) => logger.error(message, undefined, meta),
    },
    budget,
  };

  const context = baseContext as AmauraAgentContext;
  context.idempotencyKey = agent.getDedupKey(context, payload);
  return context;
}

async function startAmauraRun(
  agent: AmauraAgentDefinition<any>,
  context: AmauraAgentContext,
  payload: unknown,
  client?: SupabaseLike
) {
  const supabase = client ?? createAdminClient();
  const { data, error } = await supabase
    .from('amaura_agent_runs')
    .insert({
      user_id: context.userId,
      goal_id: context.goalId,
      agent_name: agent.name,
      event_id: context.eventId,
      event_type: context.eventType,
      dedup_key: context.idempotencyKey,
      status: 'running',
      input: payload ?? {},
      started_at: context.now.toISOString(),
      created_at: context.now.toISOString(),
      updated_at: context.now.toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data.id as string;
}

async function finishAmauraRun(
  runId: string,
  result: AmauraAgentResult,
  client?: SupabaseLike
) {
  const supabase = client ?? createAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('amaura_agent_runs')
    .update({
      status: result.skipped ? 'skipped' : 'completed',
      output: result,
      finished_at: now,
      updated_at: now,
    })
    .eq('id', runId);

  if (error) throw error;
}

async function failAmauraRun(runId: string, error: unknown, client?: SupabaseLike) {
  const supabase = client ?? createAdminClient();
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('amaura_agent_runs')
    .update({
      status: 'failed',
      error: error instanceof Error ? error.message.slice(0, 2000) : String(error).slice(0, 2000),
      finished_at: now,
      updated_at: now,
    })
    .eq('id', runId);

  if (updateError) throw updateError;
}

function getGoalId(payload: any) {
  const candidate = payload?.goalId ?? payload?.goal_id;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : null;
}
