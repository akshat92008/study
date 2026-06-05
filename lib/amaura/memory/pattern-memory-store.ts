import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = ReturnType<typeof createAdminClient>;

export type PatternMemoryInput = {
  goalId?: string | null;
  conceptId?: string | null;
  subject?: string | null;
  chapter?: string | null;
  topic?: string | null;
  patternType: string;
  pattern: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
  confidence?: number;
  weight?: number;
  evidence?: Record<string, unknown>;
  sourceRefs?: unknown[];
};

export type PatternMemoryRecord = PatternMemoryInput & {
  id: string;
  user_id: string;
  occurrences: number;
  status: 'active' | 'decayed' | 'resolved' | 'archived';
  last_seen_at: string;
};

export async function writePatternMemoryForUser(
  userId: string,
  input: PatternMemoryInput,
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  const now = new Date().toISOString();

  const existing = await findExistingPatternMemory(supabase, userId, input);
  if (existing) {
    const { data, error } = await supabase
      .from('amaura_pattern_memories')
      .update({
        occurrences: Number(existing.occurrences ?? 0) + 1,
        severity: input.severity ?? existing.severity ?? 'medium',
        confidence: clamp(input.confidence ?? existing.confidence ?? 0.6, 0, 1),
        weight: clamp(input.weight ?? existing.weight ?? 0.6, 0, 1),
        evidence: {
          ...(existing.evidence ?? {}),
          ...(input.evidence ?? {}),
          lastSourceRefs: input.sourceRefs ?? [],
        },
        source_refs: mergeRefs(existing.source_refs, input.sourceRefs),
        status: 'active',
        last_seen_at: now,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', userId)
      .select('*')
      .single();

    if (error) throw error;
    return data;
  }

  const { data, error } = await supabase
    .from('amaura_pattern_memories')
    .insert({
      user_id: userId,
      goal_id: input.goalId ?? null,
      concept_id: input.conceptId ?? null,
      subject: input.subject ?? null,
      chapter: input.chapter ?? null,
      topic: input.topic ?? null,
      pattern_type: input.patternType,
      pattern: input.pattern,
      severity: input.severity ?? 'medium',
      confidence: clamp(input.confidence ?? 0.6, 0, 1),
      weight: clamp(input.weight ?? 0.6, 0, 1),
      evidence: input.evidence ?? {},
      source_refs: input.sourceRefs ?? [],
      status: 'active',
      first_seen_at: now,
      last_seen_at: now,
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function readPatternMemoriesForUser(
  userId: string,
  input: {
    goalId?: string | null;
    status?: 'active' | 'decayed' | 'resolved' | 'archived';
    limit?: number;
  } = {},
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  let query = supabase
    .from('amaura_pattern_memories')
    .select('*')
    .eq('user_id', userId)
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(1, Math.min(input.limit ?? 25, 100)));

  if (input.goalId) query = query.eq('goal_id', input.goalId);
  if (input.status) query = query.eq('status', input.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as PatternMemoryRecord[];
}

export async function updatePatternMemoryForUser(
  userId: string,
  memoryId: string,
  patch: {
    weight?: number;
    status?: 'active' | 'decayed' | 'resolved' | 'archived';
    evidence?: Record<string, unknown>;
  },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.weight !== undefined) update.weight = clamp(patch.weight, 0, 1);
  if (patch.status) update.status = patch.status;
  if (patch.evidence) update.evidence = patch.evidence;

  const { data, error } = await supabase
    .from('amaura_pattern_memories')
    .update(update)
    .eq('id', memoryId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

async function findExistingPatternMemory(
  supabase: SupabaseLike,
  userId: string,
  input: PatternMemoryInput
) {
  let query = supabase
    .from('amaura_pattern_memories')
    .select('*')
    .eq('user_id', userId)
    .eq('pattern_type', input.patternType)
    .limit(1);

  query = input.goalId ? query.eq('goal_id', input.goalId) : query.is('goal_id', null);
  query = input.conceptId ? query.eq('concept_id', input.conceptId) : query.is('concept_id', null);
  query = input.topic ? query.eq('topic', input.topic) : query.is('topic', null);

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

function mergeRefs(existing: unknown, incoming: unknown[] | undefined) {
  const refs = Array.isArray(existing) ? existing : [];
  const merged = [...refs, ...(incoming ?? [])];
  return merged.slice(-25);
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}
