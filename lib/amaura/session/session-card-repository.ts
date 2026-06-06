import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = {
  from: (table: string) => any;
};

type RepositoryOptions = {
  client?: SupabaseLike;
};

export type TodayMissionInput = {
  userId: string;
  goalId?: string | null;
  task: any;
  reason: string;
  date?: string;
};

function client(options: RepositoryOptions = {}) {
  return options.client ?? createAdminClient();
}

export async function getTodaySessionCard(userId: string, options: RepositoryOptions = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client(options)
    .from('session_cards')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function upsertTodayMission(input: TodayMissionInput, options: RepositoryOptions = {}) {
  const supabase = client(options);
  const date = input.date ?? new Date().toISOString().slice(0, 10);
  const existing = await supabase
    .from('session_cards')
    .select('*')
    .eq('user_id', input.userId)
    .eq('goal_id', input.goalId ?? input.task.goal_id ?? null)
    .eq('date', date)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const row = toSessionCardRow(input, date);
  const result = existing.data
    ? await supabase
        .from('session_cards')
        .update(row)
        .eq('id', existing.data.id)
        .select('*')
        .single()
    : await supabase
        .from('session_cards')
        .insert(row)
        .select('*')
        .single();

  if (result.error) throw result.error;
  return result.data;
}

export async function updateMissionFromTask(input: TodayMissionInput, options: RepositoryOptions = {}) {
  return upsertTodayMission(input, options);
}

export async function serviceUpsertNextAction(input: TodayMissionInput, options: RepositoryOptions = {}) {
  return upsertTodayMission(input, options);
}

function toSessionCardRow(input: TodayMissionInput, date: string) {
  const task = input.task;
  return {
    user_id: input.userId,
    goal_id: input.goalId ?? task.goal_id ?? null,
    date,
    learner_state_version: 0,
    dayNumber: 1,
    streakDays: 0,
    focusTopic: task.topic ?? task.title,
    subject: task.subject ?? 'General',
    estimatedMinutes: task.estimated_minutes ?? task.estimatedMinutes ?? 15,
    rationale: input.reason,
    daysToExam: null,
    overdueCards: 0,
    masteryPercent: 0,
    closingMessage: null,
    taskType: task.type ?? 'custom',
    resourceType: task.type === 'practice' ? 'practice' : 'lesson',
    targetConceptId: task.concept_id ?? task.conceptId ?? null,
    priority: task.priority ?? 'medium',
    isCompleted: false,
    completedAt: null,
    selectionReason: input.reason,
    mistakeCount: 0,
    weakConceptCount: task.type === 'weak_concept_repair' ? 1 : 0,
    hasActiveGoal: Boolean(input.goalId ?? task.goal_id),
  };
}
