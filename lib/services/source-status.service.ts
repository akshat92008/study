import { EventDispatcher } from '@/lib/events/orchestrator';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import type { HermesSourceStatus } from '@/lib/hermes/ui/types';

type SourceRow = {
  id: string;
  title?: string | null;
  original_filename?: string | null;
  status?: string | null;
  retry_count?: number | null;
  last_error?: string | null;
  error_message?: string | null;
  chunk_count?: number | null;
  embedding_count?: number | null;
  queued_at?: string | null;
  processing_started_at?: string | null;
  embedding_started_at?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
  goal_id?: string | null;
};

export type SourceStallStatus =
  | 'active'
  | 'stalled_queued'
  | 'stalled_processing'
  | 'stalled_embedding'
  | 'needs_user_action';

function minutesSince(value?: string | null): number {
  if (!value) return 0;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return 0;
  return (Date.now() - timestamp) / 60_000;
}

export function detectStalledSources(source: SourceRow): SourceStallStatus {
  const status = source.status ?? 'uploaded';
  const retryCount = source.retry_count ?? 0;

  if (retryCount >= 3) return 'needs_user_action';
  if (status === 'ready' && (source.chunk_count ?? 1) <= 0) return 'needs_user_action';
  if (status === 'queued' && minutesSince(source.queued_at ?? source.created_at) > 5) return 'stalled_queued';
  if (status === 'processing' && minutesSince(source.processing_started_at ?? source.updated_at) > 10) return 'stalled_processing';
  if (status === 'embedding' && minutesSince(source.embedding_started_at ?? source.updated_at) > 10) return 'stalled_embedding';
  return 'active';
}

export function sourceStatusLabel(status: string | null | undefined, stall: SourceStallStatus): string {
  if (stall === 'needs_user_action') return 'Needs clearer file';
  if (stall === 'stalled_queued') return 'Waiting to process';
  if (stall === 'stalled_processing') return 'Extracting text';
  if (stall === 'stalled_embedding') return 'Building source memory';

  switch (status) {
    case 'ready':
      return 'Ready for tutor';
    case 'queued':
    case 'uploaded':
      return 'Waiting to process';
    case 'processing':
    case 'parsed':
      return 'Extracting text';
    case 'embedding':
      return 'Building source memory';
    case 'needs_user_action':
      return 'Needs clearer file';
    case 'failed':
      return 'Failed, retry available';
    default:
      return 'Waiting to process';
  }
}

export function toHermesSourceStatus(row: SourceRow): HermesSourceStatus {
  const stall = detectStalledSources(row);
  const status = stall === 'needs_user_action' ? 'needs_user_action' : row.status ?? 'uploaded';
  return {
    id: row.id,
    title: row.title ?? row.original_filename ?? 'Untitled source',
    status,
    label: sourceStatusLabel(status, stall),
    canRetry: ['failed', 'queued', 'processing', 'embedding', 'needs_user_action'].includes(status)
      || stall !== 'active',
    retryCount: row.retry_count ?? 0,
    lastError: row.last_error ?? row.error_message ?? null,
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
}

export async function getSourceStatusesForGoal(input: {
  supabase: any;
  userId: string;
  goalId?: string | null;
  limit?: number;
}): Promise<HermesSourceStatus[]> {
  if (input.goalId) await ensureGoalForUser(input.supabase, input.userId, input.goalId);

  let query = input.supabase
    .from('study_materials')
    .select('id, title, original_filename, status, retry_count, last_error, error_message, chunk_count, embedding_count, queued_at, processing_started_at, embedding_started_at, updated_at, created_at, goal_id')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(input.limit ?? 10);

  query = input.goalId
    ? query.eq('goal_id', input.goalId)
    : query;

  const { data, error } = await query;
  if (error) throw new Error('Unable to load source status.');
  return (data ?? []).map(toHermesSourceStatus);
}

export async function retrySourceProcessing(input: {
  supabase: any;
  userId: string;
  sourceId: string;
  goalId?: string | null;
}): Promise<HermesSourceStatus> {
  let query = input.supabase
    .from('study_materials')
    .select('id, title, original_filename, status, retry_count, goal_id')
    .eq('id', input.sourceId)
    .eq('user_id', input.userId);

  if (input.goalId) query = query.eq('goal_id', input.goalId);

  const { data: source, error } = await query.maybeSingle();
  if (error || !source) throw new Error('Source not found.');
  if (source.goal_id) await ensureGoalForUser(input.supabase, input.userId, source.goal_id);

  const retryCount = Number(source.retry_count ?? 0);
  if (retryCount >= 3) {
    return markSourceNeedsUserAction({
      supabase: input.supabase,
      userId: input.userId,
      sourceId: input.sourceId,
      reason: 'Maximum retries reached.',
    });
  }

  const { data: updated, error: updateError } = await input.supabase
    .from('study_materials')
    .update({
      status: 'queued',
      queued_at: new Date().toISOString(),
      retry_count: retryCount + 1,
      last_error: null,
      next_retry_at: null,
    })
    .eq('id', input.sourceId)
    .eq('user_id', input.userId)
    .select('id, title, original_filename, status, retry_count, last_error, error_message, chunk_count, embedding_count, queued_at, processing_started_at, embedding_started_at, updated_at, created_at, goal_id')
    .single();

  if (updateError || !updated) throw new Error('Unable to retry source processing.');

  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'HERMES_SOURCE_PROCESS_REQUESTED',
    data: { materialId: input.sourceId, goalId: updated.goal_id ?? null },
    metadata: { source: 'hermes_ui_source_retry', goalId: updated.goal_id ?? null },
    idempotency_key: `hermes_source_retry:${input.userId}:${input.sourceId}:${retryCount + 1}`,
  }).catch(() => undefined);

  return toHermesSourceStatus(updated);
}

export async function markSourceNeedsUserAction(input: {
  supabase: any;
  userId: string;
  sourceId: string;
  reason: string;
}): Promise<HermesSourceStatus> {
  const { data, error } = await input.supabase
    .from('study_materials')
    .update({
      status: 'needs_user_action',
      failed_at: new Date().toISOString(),
      last_error: input.reason,
    })
    .eq('id', input.sourceId)
    .eq('user_id', input.userId)
    .select('id, title, original_filename, status, retry_count, last_error, error_message, chunk_count, embedding_count, queued_at, processing_started_at, embedding_started_at, updated_at, created_at, goal_id')
    .single();

  if (error || !data) throw new Error('Unable to update source status.');
  return toHermesSourceStatus(data);
}
