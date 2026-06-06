import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = {
  from: (table: string) => any;
};

type RepositoryOptions = {
  client?: SupabaseLike;
};

export type AmauraObservationInput = {
  userId: string;
  goalId?: string | null;
  taskId?: string | null;
  source: string;
  observationType: string;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  confidence?: number;
  score?: number | null;
  payload?: Record<string, unknown>;
  sourceEventId?: string | null;
  dedupKey?: string | null;
};

function client(options: RepositoryOptions = {}) {
  return options.client ?? createAdminClient();
}

export async function recordObservation(input: AmauraObservationInput, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_evidence')
    .insert(toObservationRow(input))
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function recordObservationIfNotExists(
  input: AmauraObservationInput,
  options: RepositoryOptions = {}
) {
  const supabase = client(options);
  const dedupKey = input.dedupKey ?? buildObservationDedupKey(input);
  if (dedupKey) {
    const existing = await supabase
      .from('learning_evidence')
      .select('*')
      .eq('user_id', input.userId)
      .eq('dedup_key', dedupKey)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;
  }

  return recordObservation({ ...input, dedupKey }, { client: supabase });
}

export async function listRecentObservations(userId: string, limit = 20, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_evidence')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 100)));

  if (error) throw error;
  return data ?? [];
}

export async function listGoalObservations(goalId: string, userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_evidence')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw error;
  return data ?? [];
}

export async function listTaskObservations(taskId: string, userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_evidence')
    .select('*')
    .eq('task_id', taskId)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function serviceRecordObservation(
  input: AmauraObservationInput,
  options: RepositoryOptions = {}
) {
  return recordObservationIfNotExists(input, options);
}

function toObservationRow(input: AmauraObservationInput) {
  return {
    user_id: input.userId,
    goal_id: input.goalId ?? null,
    task_id: input.taskId ?? null,
    source: input.source,
    observation_type: input.observationType,
    source_type: input.source,
    source_id: input.sourceEventId ?? input.dedupKey ?? null,
    source_event_id: input.sourceEventId ?? null,
    subject: input.subject ?? null,
    chapter: input.chapter ?? null,
    topic: input.topic ?? null,
    evidence_type: input.observationType,
    score: input.score ?? null,
    confidence: Math.max(0, Math.min(input.confidence ?? 0.5, 1)),
    payload: input.payload ?? {},
    dedup_key: input.dedupKey ?? buildObservationDedupKey(input),
    created_at: new Date().toISOString(),
  };
}

function buildObservationDedupKey(input: AmauraObservationInput) {
  if (!input.sourceEventId) return input.dedupKey ?? null;
  return `${input.source}:${input.sourceEventId}:${input.observationType}`;
}
