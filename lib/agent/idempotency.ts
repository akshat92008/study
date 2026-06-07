/**
 * Idempotency management for agent runs.
 * Ensures duplicate requests don't produce duplicate mutations.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AgentRunRecord {
  id: string;
  user_id: string;
  status: string;
  updated_at: string;
  [key: string]: unknown;
}

export interface IdempotencyCheckResult {
  allowed: boolean;
  existingRun: AgentRunRecord | null;
  reason?: string;
}

/**
 * Check if an agent run already exists for the given idempotency key.
 * If it exists and is 'completed', return the existing run (idempotency hit).
 * If it exists and is 'failed', allow retry if policy permits.
 * If it exists and is 'running', block (concurrent execution).
 */
export async function checkIdempotencyForRun(
  supabase: SupabaseClient,
  userId: string,
  idempotencyKey: string,
  agentName: string = 'cognition_runtime'
): Promise<IdempotencyCheckResult> {
  const { data: existing, error } = await supabase
    .from('agent_runs')
    .select('*')
    .eq('user_id', userId)
    .eq('idempotency_key', idempotencyKey)
    .eq('agent_name', agentName)
    .maybeSingle();

  if (error) {
    return {
      allowed: true,
      existingRun: existing as unknown as AgentRunRecord | null,
      reason: `Idempotency lookup failed: ${error.message}. Proceeding to avoid blocking.`,
    };
  }

  if (!existing) {
    return { allowed: true, existingRun: null };
  }

  // Completed run - return idempotency hit, no new run needed
  if (existing.status === 'completed') {
    return {
      allowed: false,
      existingRun: existing as unknown as AgentRunRecord,
      reason: 'Existing completed run found. Returning existing result.',
    };
  }

  // Running - block concurrent execution
  if (existing.status === 'running') {
    return {
      allowed: false,
      existingRun: existing as unknown as AgentRunRecord,
      reason: 'Concurrent run already in progress. Blocking duplicate.',
    };
  }

  // Failed run - allow retry if recent (< 1 hour)
  if (existing.status === 'failed') {
    const updatedAt = new Date(existing.updated_at);
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    if (updatedAt > oneHourAgo) {
      return {
        allowed: true,
        existingRun: existing as unknown as AgentRunRecord | null,
        reason: `Previous run failed at ${existing.updated_at}. Allowing retry.`,
      };
    }
    return {
      allowed: false,
      existingRun: existing as unknown as AgentRunRecord,
      reason: 'Previous run failed too long ago. Not allowing retry without explicit idempotency override.',
    };
  }

  // Cancelled or any other status - block by default
  return {
    allowed: false,
    existingRun: existing as unknown as AgentRunRecord,
    reason: `Run in status '${existing.status}'. Blocking duplicate.`,
  };
}

/**
 * Generate a stable idempotency key for agent runs.
 * Key is based on userId + channel + source identifiers, NOT on final response.
 */
export function generateIdempotencyKey(input: {
  userId: string;
  channel: string;
  sessionId?: string | null;
  conversationId?: string | null;
  goalId?: string | null;
  eventId?: string | null;
  sourceEventId?: string | null;
  payloadHash?: string;
}): string {
  const parts = [
    input.userId,
    input.channel,
    input.sessionId ?? '',
    input.conversationId ?? '',
    input.goalId ?? '',
    input.eventId ?? '',
    input.sourceEventId ?? '',
    input.payloadHash ?? '',
  ];
  return `cog-runtime:${input.channel}:${parts.slice(1).filter(Boolean).join(':')}`;
}

/**
 * Build a hash of the payload for idempotency if needed.
 */
export function hashPayload(payload: Record<string, unknown>): string {
  const str = JSON.stringify(payload, Object.keys(payload).sort());
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}

/**
 * Check if a previous failed run can be retried.
 * Allow retry if the failed run is old or if explicit retry flag is set.
 */
export async function canRetryRun(
  supabase: SupabaseClient,
  runId: string,
  maxAgeHours: number = 24
): Promise<boolean> {
  const { data: run, error } = await supabase
    .from('agent_runs')
    .select('status, updated_at')
    .eq('id', runId)
    .maybeSingle();

  if (error || !run) return false;
  if (run.status !== 'failed') return false;

  const updatedAt = new Date(run.updated_at);
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
  return updatedAt < cutoff;
}