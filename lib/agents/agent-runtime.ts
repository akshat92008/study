import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { assertBetaAgentActionAllowed, classifyAgentActionRisk } from './beta-policy';
import {
  AgentActionInputSchema,
  AgentRunInputSchema,
  type AgentActionInput,
  type AgentRunInput,
  type JsonRecord,
} from './types';

type SupabaseLike = ReturnType<typeof createAdminClient>;

type ApplyFn = (action: any) => Promise<JsonRecord | void>;

function nowIso() {
  return new Date().toISOString();
}

function getClient(client?: SupabaseLike) {
  return client ?? createAdminClient();
}

export async function startAgentRun(
  input: AgentRunInput,
  options: { client?: SupabaseLike } = {}
) {
  const parsed = AgentRunInputSchema.parse(input);
  const supabase = getClient(options.client);

  const { data: existing, error: existingError } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('user_id', parsed.userId)
    .eq('agent_name', parsed.agentName)
    .eq('idempotency_key', parsed.idempotencyKey)
    .maybeSingle();

  if (existingError) {
    logger.error('Agent run idempotency lookup failed', existingError, {
      userId: parsed.userId,
      agentName: parsed.agentName,
    });
    throw existingError;
  }

  if (existing) return existing;

  const startedAt = nowIso();
  const { data, error } = await supabase
    .from('agent_runs')
    .insert({
      user_id: parsed.userId,
      agent_name: parsed.agentName,
      trigger_type: parsed.triggerType,
      trigger_event_id: parsed.triggerEventId ?? null,
      trigger_source: parsed.triggerSource ?? null,
      status: 'running',
      started_at: startedAt,
      input_snapshot: parsed.inputSnapshot,
      attempt_count: 1,
      idempotency_key: parsed.idempotencyKey,
      created_at: startedAt,
      updated_at: startedAt,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Agent run start failed', error, {
      userId: parsed.userId,
      agentName: parsed.agentName,
      idempotencyKey: parsed.idempotencyKey,
    });
    throw error;
  }

  logger.info('Agent run started', {
    userId: parsed.userId,
    agentName: parsed.agentName,
    runId: data.id,
  });

  return data;
}

export async function completeAgentRun(
  runId: string,
  outputSummary: JsonRecord = {},
  options: { client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(runId);
  const completedAt = nowIso();
  const supabase = getClient(options.client);

  const { data, error } = await supabase
    .from('agent_runs')
    .update({
      status: 'completed',
      completed_at: completedAt,
      output_summary: outputSummary,
      error: null,
      error_code: null,
      updated_at: completedAt,
    })
    .eq('id', runId)
    .select('*')
    .single();

  if (error) {
    logger.error('Agent run completion failed', error, { runId });
    throw error;
  }

  logger.info('Agent run completed', { runId, agentName: data.agent_name });
  return data;
}

export async function failAgentRun(
  runId: string,
  error: unknown,
  options: { client?: SupabaseLike; errorCode?: string } = {}
) {
  z.string().uuid().parse(runId);
  const completedAt = nowIso();
  const message = error instanceof Error ? error.message : String(error);
  const supabase = getClient(options.client);

  const { data, error: updateError } = await supabase
    .from('agent_runs')
    .update({
      status: 'failed',
      completed_at: completedAt,
      error: message.slice(0, 2000),
      error_code: options.errorCode ?? null,
      updated_at: completedAt,
    })
    .eq('id', runId)
    .select('*')
    .single();

  if (updateError) {
    logger.error('Agent run failure update failed', updateError, { runId, originalError: message });
    throw updateError;
  }

  logger.warn('Agent run failed', { runId, agentName: data.agent_name, error: message });
  return data;
}

export async function recordAgentAction(
  input: AgentActionInput,
  options: { client?: SupabaseLike } = {}
) {
  const parsed = AgentActionInputSchema.parse(input);
  const betaPolicy = assertBetaAgentActionAllowed(parsed.actionType);
  if (!betaPolicy.allowed) {
    logger.info('Agent action skipped by beta policy', {
      userId: parsed.userId,
      actionType: parsed.actionType,
      reason: betaPolicy.reason,
    });
    return {
      user_id: parsed.userId,
      action_type: parsed.actionType,
      status: 'SKIPPED_INTENTIONALLY',
      reason: betaPolicy.reason,
      idempotency_key: parsed.idempotencyKey,
    };
  }

  const supabase = getClient(options.client);

  const { data: existing, error: existingError } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('user_id', parsed.userId)
    .eq('action_type', parsed.actionType)
    .eq('idempotency_key', parsed.idempotencyKey)
    .maybeSingle();

  if (existingError) {
    logger.error('Agent action idempotency lookup failed', existingError, {
      userId: parsed.userId,
      actionType: parsed.actionType,
    });
    throw existingError;
  }

  if (existing) return existing;

  const riskLevel = parsed.riskLevel ?? classifyAgentActionRisk(
    parsed.actionType,
    parsed.confidence ?? null,
    parsed.evidence
  );
  const approvalStatus = parsed.approvalStatus
    ?? (riskLevel === 'requires_approval' ? 'pending' : 'not_required');
  const status = parsed.status
    ?? (approvalStatus === 'pending' ? 'pending_approval' : 'proposed');
  const createdAt = nowIso();

  const { data, error } = await supabase
    .from('agent_actions')
    .insert({
      run_id: parsed.runId ?? null,
      user_id: parsed.userId,
      agent_name: parsed.agentName,
      action_type: parsed.actionType,
      target_type: parsed.targetType ?? null,
      target_id: parsed.targetId ?? null,
      status,
      risk_level: riskLevel,
      approval_status: approvalStatus,
      confidence: parsed.confidence ?? null,
      evidence: parsed.evidence,
      reason: parsed.reason ?? null,
      before_state: parsed.beforeState,
      after_state: parsed.afterState,
      idempotency_key: parsed.idempotencyKey,
      created_at: createdAt,
      updated_at: createdAt,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Agent action record failed', error, {
      userId: parsed.userId,
      actionType: parsed.actionType,
      idempotencyKey: parsed.idempotencyKey,
    });
    throw error;
  }

  logger.info('Agent action recorded', {
    userId: parsed.userId,
    actionId: data.id,
    actionType: parsed.actionType,
    riskLevel,
    status,
  });

  return data;
}

export async function markActionPendingApproval(
  actionId: string,
  options: { client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(actionId);
  const supabase = getClient(options.client);
  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: 'pending_approval',
      approval_status: 'pending',
      risk_level: 'requires_approval',
      updated_at: nowIso(),
    })
    .eq('id', actionId)
    .select('*')
    .single();

  if (error) {
    logger.error('Agent action pending approval update failed', error, { actionId });
    throw error;
  }
  return data;
}

export async function approveAgentAction(
  actionId: string,
  userId: string,
  reason?: string,
  options: { client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(actionId);
  z.string().uuid().parse(userId);
  const supabase = getClient(options.client);
  const decidedAt = nowIso();

  const { data: action, error: fetchError } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!action) throw new Error('Agent action not found');
  if (action.approval_status === 'rejected') throw new Error('Rejected actions cannot be approved');

  await supabase
    .from('agent_action_approvals')
    .upsert({
      action_id: actionId,
      user_id: userId,
      decision: 'approved',
      reason: reason ?? null,
      decided_at: decidedAt,
    }, { onConflict: 'action_id,user_id' });

  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: action.status === 'applied' ? 'applied' : 'approved',
      approval_status: 'approved',
      updated_at: decidedAt,
    })
    .eq('id', actionId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    logger.error('Agent action approval failed', error, { actionId, userId });
    throw error;
  }
  logger.info('Agent action approved', { actionId, userId });
  return data;
}

export async function rejectAgentAction(
  actionId: string,
  userId: string,
  reason?: string,
  options: { client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(actionId);
  z.string().uuid().parse(userId);
  const supabase = getClient(options.client);
  const decidedAt = nowIso();

  const { data: action, error: fetchError } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!action) throw new Error('Agent action not found');
  if (action.status === 'applied') throw new Error('Applied actions cannot be rejected');
  if (action.approval_status === 'approved' || action.status === 'approved') return action;

  await supabase
    .from('agent_action_approvals')
    .upsert({
      action_id: actionId,
      user_id: userId,
      decision: 'rejected',
      reason: reason ?? null,
      decided_at: decidedAt,
    }, { onConflict: 'action_id,user_id' });

  const { data, error } = await supabase
    .from('agent_actions')
    .update({
      status: 'rejected',
      approval_status: 'rejected',
      updated_at: decidedAt,
    })
    .eq('id', actionId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) {
    logger.error('Agent action rejection failed', error, { actionId, userId });
    throw error;
  }
  logger.info('Agent action rejected', { actionId, userId });
  return data;
}

export async function applyAgentAction(
  actionId: string,
  applyFn: ApplyFn,
  options: { client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(actionId);
  const supabase = getClient(options.client);

  const { data: action, error: fetchError } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .maybeSingle();

  if (fetchError) throw fetchError;
  if (!action) throw new Error('Agent action not found');
  if (action.status === 'applied' || action.status === 'skipped') return action;
  if (action.approval_status === 'pending') {
    throw new Error('Agent action requires approval before application');
  }
  if (action.approval_status === 'rejected' || action.status === 'rejected') {
    return action;
  }
  const betaPolicy = assertBetaAgentActionAllowed(action.action_type);
  if (!betaPolicy.allowed) {
    logger.info('Agent action application skipped by beta policy', {
      actionId,
      actionType: action.action_type,
      reason: betaPolicy.reason,
    });
    return {
      ...action,
      status: 'skipped',
      reason: betaPolicy.reason,
    };
  }

  try {
    const afterState = await applyFn(action);
    const { data, error } = await supabase
      .from('agent_actions')
      .update({
        status: 'applied',
        after_state: afterState ?? action.after_state ?? {},
        applied_at: nowIso(),
        updated_at: nowIso(),
        error: null,
        error_code: null,
      })
      .eq('id', actionId)
      .select('*')
      .single();

    if (error) throw error;
    logger.info('Agent action applied', { actionId, actionType: action.action_type });
    return data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from('agent_actions')
      .update({
        status: 'failed',
        error: message.slice(0, 2000),
        updated_at: nowIso(),
      })
      .eq('id', actionId);
    logger.error('Agent action apply failed', err, { actionId });
    throw err;
  }
}

export async function createAgentSnapshot(
  input: { userId: string; runId?: string | null; snapshotType: string; snapshot: JsonRecord },
  options: { client?: SupabaseLike } = {}
) {
  z.object({
    userId: z.string().uuid(),
    runId: z.string().uuid().nullable().optional(),
    snapshotType: z.string().min(1),
    snapshot: z.record(z.unknown()),
  }).parse(input);

  const supabase = getClient(options.client);
  const { data, error } = await supabase
    .from('agent_state_snapshots')
    .insert({
      user_id: input.userId,
      run_id: input.runId ?? null,
      snapshot_type: input.snapshotType,
      snapshot: input.snapshot,
    })
    .select('*')
    .single();

  if (error) {
    logger.error('Agent snapshot create failed', error, {
      userId: input.userId,
      runId: input.runId,
      snapshotType: input.snapshotType,
    });
    throw error;
  }
  return data;
}

export async function getRecentAgentActivity(
  userId: string,
  options: { limit?: number; client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(userId);
  const supabase = getClient(options.client);
  const limit = Math.max(1, Math.min(options.limit ?? 25, 100));

  const [{ data: runs, error: runsError }, { data: actions, error: actionsError }] = await Promise.all([
    supabase
      .from('agent_runs')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
    supabase
      .from('agent_actions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit),
  ]);

  if (runsError) throw runsError;
  if (actionsError) throw actionsError;
  return { runs: runs ?? [], actions: actions ?? [] };
}

export async function getPendingAgentActions(
  userId: string,
  options: { limit?: number; client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(userId);
  const supabase = getClient(options.client);
  const limit = Math.max(1, Math.min(options.limit ?? 50, 100));
  const { data, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('user_id', userId)
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data ?? [];
}

export async function assertActionIdempotency(
  userId: string,
  actionType: string,
  idempotencyKey: string,
  options: { client?: SupabaseLike } = {}
) {
  z.string().uuid().parse(userId);
  z.string().min(1).parse(actionType);
  z.string().min(1).parse(idempotencyKey);
  const supabase = getClient(options.client);
  const { data, error } = await supabase
    .from('agent_actions')
    .select('id, status')
    .eq('user_id', userId)
    .eq('action_type', actionType)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();

  if (error) throw error;
  return data ?? null;
}
