import { completeAgentRun, createAgentSnapshot, failAgentRun, startAgentRun } from './agent-runtime';
import type { AgentName } from './types';
import { logger } from '@/lib/utils/logger';

const CONSUMER_AGENT_MAP: Record<string, AgentName> = {
  chat_side_effect_engine: 'mind',
  learning_state_engine: 'system',
  atlas_engine: 'atlas',
  memory_engine: 'memory',
  command_engine: 'command',
  autopsy_engine: 'autopsy',
  concept_expansion_engine: 'atlas',
  mind_agent: 'mind',
  rag_agent: 'rag',
  atlas_agent: 'atlas',
  memory_agent: 'memory',
  autopsy_agent: 'autopsy',
  planner_agent: 'planner',
  command_agent: 'command',
  pulse_agent: 'pulse',
};

export async function runAgenticConsumer<T>(
  lease: any,
  execute: () => Promise<T>
): Promise<T> {
  const agentName = CONSUMER_AGENT_MAP[String(lease.consumer_name)] ?? 'system';
  const idempotencyKey = [
    'event_consumer',
    lease.event_id,
    lease.consumer_name,
    lease.lock_id,
  ].filter(Boolean).join(':');

  let runId: string | null = null;

  try {
    const run = await startAgentRun({
      userId: lease.user_id,
      agentName,
      triggerType: 'event',
      triggerEventId: lease.event_id,
      triggerSource: lease.consumer_name,
      inputSnapshot: {
        eventType: lease.event_type,
        payload: lease.event_payload ?? {},
        metadata: lease.event_metadata ?? {},
        retryCount: lease.retry_count ?? 0,
      },
      idempotencyKey,
    });
    runId = run.id;

    await createAgentSnapshot({
      userId: lease.user_id,
      runId,
      snapshotType: 'event_lease',
      snapshot: {
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
        payload: lease.event_payload ?? {},
      },
    });
  } catch (err) {
    logger.warn('Agent runtime unavailable for event consumer; continuing legacy handler', {
      eventId: lease.event_id,
      eventType: lease.event_type,
      consumer: lease.consumer_name,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const result = await execute();
    if (runId) {
      await completeAgentRun(runId, {
        eventId: lease.event_id,
        eventType: lease.event_type,
        consumer: lease.consumer_name,
      }).catch((err) => {
        logger.warn('Agent run completion write failed', {
          runId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    }
    return result;
  } catch (err) {
    if (runId) {
      await failAgentRun(runId, err).catch((failureErr) => {
        logger.warn('Agent run failure write failed', {
          runId,
          error: failureErr instanceof Error ? failureErr.message : String(failureErr),
        });
      });
    }
    throw err;
  }
}
