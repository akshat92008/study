import { createAdminClient } from '@/lib/supabase/admin';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import {
  readPatternMemoriesForUser,
  updatePatternMemoryForUser,
  writePatternMemoryForUser as writeNativePatternMemoryForUser,
  type PatternMemoryInput,
} from '@/lib/amaura/memory/pattern-memory-store';
import type { AmauraNotificationPriority } from './types';

type SupabaseLike = ReturnType<typeof createAdminClient>;

export type AmauraNotificationInput = {
  goalId?: string | null;
  type: string;
  priority?: AmauraNotificationPriority;
  title: string;
  message: string;
  actionLabel?: string | null;
  actionType?: string | null;
  actionPayload?: Record<string, unknown> | null;
  dedupKey?: string | null;
  metadata?: Record<string, unknown>;
  expiresAt?: string | null;
};

export type RevisionCardInput = {
  goalId?: string | null;
  chatSessionId?: string | null;
  conceptId?: string | null;
  front: string;
  back: string;
  subject?: string | null;
  chapter?: string | null;
  dueAt?: string | null;
  sourceType: string;
  sourceId: string;
  cardType?: string | null;
  origin?: 'manual' | 'chat' | 'autopsy' | 'practice' | 'source';
  approvalStatus?: 'approved' | 'pending' | 'rejected';
  normalizedKey?: string | null;
  metadata?: Record<string, unknown>;
};

export type DailyMicrotaskInput = {
  goalId?: string | null;
  conceptId?: string | null;
  taskDate?: string | null;
  title: string;
  subject?: string | null;
  topic?: string | null;
  type: string;
  estimatedMinutes?: number;
  targetCount?: number | null;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, unknown>;
};

export async function createNotificationForUser(
  userId: string,
  input: AmauraNotificationInput,
  options: { client?: SupabaseLike } = {}
) {
  if ((input.priority ?? 'normal') === 'silent') return null;
  const supabase = options.client ?? createAdminClient();
  const row = {
    user_id: userId,
    goal_id: input.goalId ?? null,
    type: input.type,
    priority: input.priority ?? 'normal',
    title: input.title,
    message: input.message,
    action_label: input.actionLabel ?? null,
    action_type: input.actionType ?? null,
    action_payload: input.actionPayload ?? null,
    dedup_key: input.dedupKey ?? null,
    metadata: input.metadata ?? {},
    expires_at: input.expiresAt ?? null,
  };

  const query = input.dedupKey
    ? supabase
        .from('amaura_notifications')
        .upsert(row, { onConflict: 'user_id,dedup_key', ignoreDuplicates: true })
        .select('*')
        .maybeSingle()
    : supabase.from('amaura_notifications').insert(row).select('*').single();

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function hasRecentNotificationForUser(
  userId: string,
  input: {
    type?: string;
    dedupKey?: string | null;
    since: string;
  },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  let query = supabase
    .from('amaura_notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', input.since);

  if (input.type) query = query.eq('type', input.type);
  if (input.dedupKey) query = query.eq('dedup_key', input.dedupKey);

  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function createRevisionCardsForUser(
  userId: string,
  cards: RevisionCardInput[],
  options: { client?: SupabaseLike } = {}
) {
  if (cards.length === 0) return [];
  const supabase = options.client ?? createAdminClient();
  const now = new Date().toISOString();
  const rows = cards.map((card) => ({
    user_id: userId,
    goal_id: card.goalId ?? null,
    chat_session_id: card.chatSessionId ?? null,
    concept_id: card.conceptId ?? null,
    front: card.front,
    back: card.back,
    subject: card.subject ?? null,
    chapter: card.chapter ?? null,
    due: card.dueAt ?? now,
    state: 0,
    card_type: card.cardType ?? 'autopsy_recovery',
    source_type: card.sourceType,
    source_id: card.sourceId,
    origin: card.origin ?? (card.sourceType?.startsWith('amaura_') ? 'chat' : 'manual'),
    approval_status: card.approvalStatus ?? ((card.origin === 'chat' || card.sourceType?.startsWith('amaura_')) ? 'pending' : 'approved'),
    normalized_key: card.normalizedKey ?? null,
    metadata: card.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from('revision_cards')
    .upsert(rows, { onConflict: 'user_id,normalized_key', ignoreDuplicates: true })
    .select('id, concept_id, source_id');

  if (error) throw error;
  return data ?? [];
}

export async function updateConceptMasteryForUser(
  userId: string,
  conceptId: string | null | undefined,
  patch: {
    mastery?: string;
    masteryScore?: number;
    confidence?: string;
    forgettingProbability?: number;
  },
  options: { client?: SupabaseLike } = {}
) {
  if (!conceptId) return null;
  const supabase = options.client ?? createAdminClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (patch.mastery) update.mastery = patch.mastery;
  if (typeof patch.masteryScore === 'number') update.mastery_score = patch.masteryScore;
  if (patch.confidence) update.confidence = patch.confidence;
  if (typeof patch.forgettingProbability === 'number') {
    update.forgetting_probability = patch.forgettingProbability;
    update.forgetting = patch.forgettingProbability;
  }

  const { data, error } = await supabase
    .from('concepts')
    .update(update)
    .eq('id', conceptId)
    .eq('user_id', userId)
    .select('id')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function invalidateSessionCardForUser(
  userId: string,
  goalId?: string | null,
  options: { client?: SupabaseLike; sourceEventId?: string | null } = {}
) {
  await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
    client: options.client,
    goalId: goalId ?? null,
    sourceEventId: options.sourceEventId ?? null,
  });
}

export async function writePatternMemoryForUser(
  userId: string,
  input: PatternMemoryInput,
  options: { client?: SupabaseLike } = {}
) {
  return writeNativePatternMemoryForUser(userId, input, options);
}

export async function createDailyMicrotasksForUser(
  userId: string,
  tasks: DailyMicrotaskInput[],
  options: { client?: SupabaseLike } = {}
) {
  if (tasks.length === 0) return [];
  const supabase = options.client ?? createAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const rows = tasks.map((task) => ({
    user_id: userId,
    goal_id: task.goalId ?? null,
    concept_id: task.conceptId ?? null,
    task_date: task.taskDate ?? today,
    title: task.title,
    subject: task.subject ?? null,
    topic: task.topic ?? null,
    type: task.type,
    estimated_minutes: Math.max(5, Math.min(task.estimatedMinutes ?? 15, 90)),
    target_count: task.targetCount ?? null,
    priority: task.priority ?? 'medium',
    source: 'amaura',
    metadata: task.metadata ?? {},
  }));

  const { data, error } = await supabase
    .from('daily_microtasks')
    .insert(rows)
    .select('id, title');

  if (error) throw error;
  return data ?? [];
}

export async function updateProfileStreakForUser(
  userId: string,
  input: { now?: Date } = {},
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  const now = input.now ?? new Date();
  const today = now.toISOString().slice(0, 10);

  const { data: profile, error: readError } = await supabase
    .from('profiles')
    .select('id, streak_days, last_active_at')
    .eq('id', userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!profile) return null;

  const lastActiveDate = profile.last_active_at
    ? new Date(profile.last_active_at).toISOString().slice(0, 10)
    : null;
  const streakDays = lastActiveDate === today
    ? Number(profile.streak_days ?? 0)
    : Number(profile.streak_days ?? 0) + 1;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      last_active_at: now.toISOString(),
      streak_days: streakDays,
      updated_at: now.toISOString(),
    })
    .eq('id', userId)
    .select('id, streak_days, last_active_at')
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function loadRecentPracticeEvidenceForUser(
  userId: string,
  input: {
    goalId?: string | null;
    practiceSetId?: string | null;
    fallbackItems?: Array<Record<string, unknown>>;
    limit?: number;
  },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  if (!input.practiceSetId) {
    return normalizePracticeItems(input.fallbackItems ?? []);
  }

  const { data, error } = await supabase
    .from('practice_attempts')
    .select('id, is_correct, created_at, practice_item_id, practice_items(id, concept_id, concept_name, question, practice_set_id, practice_sets(id, goal_id, subject, topic))')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(input.limit ?? 15, 50)));

  if (error || !data) {
    return normalizePracticeItems(input.fallbackItems ?? []);
  }

  return data.map((row: any) => {
    const item = Array.isArray(row.practice_items) ? row.practice_items[0] : row.practice_items;
    const set = Array.isArray(item?.practice_sets) ? item.practice_sets[0] : item?.practice_sets;
    return {
      attemptId: row.id,
      conceptId: item?.concept_id ?? null,
      conceptName: item?.concept_name ?? null,
      subject: set?.subject ?? null,
      chapter: set?.topic ?? null,
      topic: item?.concept_name ?? set?.topic ?? null,
      goalId: set?.goal_id ?? null,
      isCorrect: row.is_correct === true,
      createdAt: row.created_at,
    };
  }).filter((row: any) => !input.goalId || row.goalId === input.goalId);
}

export async function hasActiveRevisionCardsForConcept(
  userId: string,
  input: { conceptId?: string | null; conceptName?: string | null; before: string },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  let query = supabase
    .from('revision_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .lte('due', input.before)
    .neq('state', 4);

  if (input.conceptId) {
    query = query.eq('concept_id', input.conceptId);
  } else if (input.conceptName) {
    query = query.contains('metadata', { conceptName: input.conceptName });
  } else {
    return false;
  }

  const { count, error } = await query;
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function countRecentRevisionCardsForConcept(
  userId: string,
  input: { conceptId?: string | null; conceptName?: string | null; since: string },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  let query = supabase
    .from('revision_cards')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', input.since);

  if (input.conceptId) {
    query = query.eq('concept_id', input.conceptId);
  } else if (input.conceptName) {
    query = query.contains('metadata', { conceptName: input.conceptName });
  } else {
    return 0;
  }

  const { count, error } = await query;
  if (error) throw error;
  return count ?? 0;
}

export async function loadAutopsyReportForUser(
  userId: string,
  input: { reportId?: string | null; assessmentId?: string | null },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  let query = supabase
    .from('autopsy_reports')
    .select('*')
    .eq('user_id', userId)
    .limit(1);

  if (input.reportId) query = query.eq('id', input.reportId);
  else if (input.assessmentId) query = query.eq('assessment_id', input.assessmentId);
  else return null;

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadDueRevisionCardsForUser(
  userId: string,
  input: { goalId?: string | null; before: string; limit?: number },
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  let query = supabase
    .from('revision_cards')
    .select('id, goal_id, concept_id, front, due, difficulty, stability, metadata')
    .eq('user_id', userId)
    .lte('due', input.before)
    .neq('state', 4)
    .order('due', { ascending: true })
    .order('difficulty', { ascending: false })
    .limit(Math.max(1, Math.min(input.limit ?? 10, 50)));

  if (input.goalId) query = query.eq('goal_id', input.goalId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function loadProfileForUser(
  userId: string,
  options: { client?: SupabaseLike } = {}
) {
  const supabase = options.client ?? createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, last_active_at, streak_days')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export { readPatternMemoriesForUser, updatePatternMemoryForUser };

function normalizePracticeItems(items: Array<Record<string, unknown>>) {
  return items.map((item) => ({
    attemptId: stringOrNull(item.attemptId ?? item.sourceId),
    conceptId: stringOrNull(item.conceptId),
    conceptName: stringOrNull(item.conceptName ?? item.topic),
    subject: stringOrNull(item.subject),
    chapter: stringOrNull(item.chapter),
    topic: stringOrNull(item.topic ?? item.conceptName),
    goalId: stringOrNull(item.goalId ?? item.goal_id),
    isCorrect: item.isCorrect === true,
    createdAt: stringOrNull(item.createdAt) ?? new Date().toISOString(),
  }));
}

function stringOrNull(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
