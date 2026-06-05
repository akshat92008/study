import { createHash } from 'node:crypto';
import { createAdminClient } from '@/lib/supabase/admin';
import type { AmauraAgentContext, AmauraAgentName } from './types';

type SupabaseLike = ReturnType<typeof createAdminClient>;

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function hashDedupParts(...parts: unknown[]): string {
  return createHash('sha256')
    .update(stableStringify(parts))
    .digest('hex')
    .slice(0, 32);
}

export function eventDedupKey(
  agentName: AmauraAgentName,
  context: AmauraAgentContext,
  payload: unknown
): string {
  return [
    'amaura',
    agentName,
    context.eventType,
    context.eventId,
    hashDedupParts(payload),
  ].join(':');
}

export function conceptWindowDedupKey(input: {
  agentName: AmauraAgentName;
  userId: string;
  eventType: string;
  conceptId?: string | null;
  conceptName?: string | null;
  window: string;
}) {
  return [
    'amaura',
    input.agentName,
    input.eventType,
    input.conceptId ?? normalizeTextKey(input.conceptName) ?? 'unknown',
    input.window,
  ].join(':');
}

export function userDayDedupKey(input: {
  agentName: AmauraAgentName;
  userId: string;
  date: string;
  reason?: string | null;
}) {
  return [
    'amaura',
    input.agentName,
    input.userId,
    input.date,
    normalizeTextKey(input.reason) ?? 'daily',
  ].join(':');
}

export async function hasCompletedAmauraRun(input: {
  userId: string;
  agentName: AmauraAgentName;
  dedupKey: string;
  client?: SupabaseLike;
}) {
  const supabase = input.client ?? createAdminClient();
  const { data, error } = await supabase
    .from('amaura_agent_runs')
    .select('id, status')
    .eq('user_id', input.userId)
    .eq('agent_name', input.agentName)
    .eq('dedup_key', input.dedupKey)
    .in('status', ['running', 'completed'])
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}

export function normalizeTextKey(value?: string | null) {
  const text = value?.trim().toLowerCase();
  if (!text) return null;
  return text.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || null;
}
