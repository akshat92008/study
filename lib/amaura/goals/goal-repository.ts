import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = {
  from: (table: string) => any;
};

type RepositoryOptions = {
  client?: SupabaseLike;
};

export type AmauraGoalInput = {
  userId: string;
  title: string;
  subject?: string | null;
  domain?: string | null;
  examType?: string | null;
  targetDate?: string | null;
  metadata?: Record<string, unknown>;
};

export type AmauraGoalPatch = {
  title?: string;
  status?: string;
  progress?: number;
  progressPercent?: number;
  riskLevel?: 'unknown' | 'low' | 'medium' | 'high';
  currentState?: Record<string, unknown>;
  desiredState?: Record<string, unknown>;
  constraints?: Record<string, unknown>;
  lastEvaluatedAt?: string | null;
  metadata?: Record<string, unknown>;
};

function client(options: RepositoryOptions = {}) {
  return options.client ?? createAdminClient();
}

export async function createGoal(input: AmauraGoalInput, options: RepositoryOptions = {}) {
  const now = new Date().toISOString();
  const { data, error } = await client(options)
    .from('learning_goals')
    .insert({
      user_id: input.userId,
      title: input.title,
      subject: input.subject ?? null,
      domain: input.domain ?? 'exam_prep',
      exam_type: input.examType ?? 'NEET',
      target_date: input.targetDate ?? null,
      progress: 0,
      progress_percent: 0,
      risk_level: 'unknown',
      agentic_status: 'active',
      current_state: {},
      desired_state: {},
      constraints: {},
      status: 'active',
      last_active_at: now,
      generated_by_agent: input.metadata?.generatedByAgent ?? null,
      metadata: input.metadata ?? {},
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function getGoal(goalId: string, userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function listActiveGoals(userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_goals')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function serviceListActiveGoals(userId: string, options: RepositoryOptions = {}) {
  return listActiveGoals(userId, options);
}

export async function serviceListGoalsDueForEvaluation(limit = 50, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('learning_goals')
    .select('*')
    .eq('status', 'active')
    .or('last_evaluated_at.is.null,last_evaluated_at.lt.now()')
    .order('last_evaluated_at', { ascending: true, nullsFirst: true })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) throw error;
  return data ?? [];
}

export async function updateGoal(
  goalId: string,
  userId: string,
  patch: AmauraGoalPatch,
  options: RepositoryOptions = {}
) {
  const { data, error } = await client(options)
    .from('learning_goals')
    .update(toGoalUpdate(patch))
    .eq('id', goalId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function serviceUpdateGoal(
  goalId: string,
  patch: AmauraGoalPatch,
  options: RepositoryOptions = {}
) {
  const { data, error } = await client(options)
    .from('learning_goals')
    .update(toGoalUpdate(patch))
    .eq('id', goalId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function archiveGoal(goalId: string, userId: string, options: RepositoryOptions = {}) {
  return updateGoal(goalId, userId, { status: 'archived', metadata: { archivedBy: 'amaura' } }, options);
}

export async function markGoalCompleted(goalId: string, userId: string, options: RepositoryOptions = {}) {
  return updateGoal(goalId, userId, {
    status: 'completed',
    progress: 100,
    progressPercent: 100,
    riskLevel: 'low',
  }, options);
}

export async function computeGoalProgress(goalId: string, userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .select('id, status, task_date')
    .eq('goal_id', goalId)
    .eq('user_id', userId);

  if (error) throw error;
  const tasks = data ?? [];
  const completed = tasks.filter((task: any) => task.status === 'done').length;
  const skipped = tasks.filter((task: any) => task.status === 'skipped').length;
  const overdue = tasks.filter((task: any) =>
    task.status === 'pending' && task.task_date && String(task.task_date) < new Date().toISOString().slice(0, 10)
  ).length;
  const progressPercent = tasks.length > 0 ? Math.min(100, Math.round((completed / tasks.length) * 100)) : 0;

  return {
    totalTasks: tasks.length,
    completedTasks: completed,
    skippedTasks: skipped,
    overdueTasks: overdue,
    progressPercent,
  };
}

function toGoalUpdate(patch: AmauraGoalPatch) {
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
    last_active_at: new Date().toISOString(),
  };
  if (patch.title !== undefined) update.title = patch.title;
  if (patch.status !== undefined) update.status = patch.status;
  if (patch.progress !== undefined) update.progress = patch.progress;
  if (patch.progressPercent !== undefined) {
    update.progress = patch.progressPercent;
    update.progress_percent = patch.progressPercent;
  }
  if (patch.riskLevel !== undefined) update.risk_level = patch.riskLevel;
  if (patch.currentState !== undefined) update.current_state = patch.currentState;
  if (patch.desiredState !== undefined) update.desired_state = patch.desiredState;
  if (patch.constraints !== undefined) update.constraints = patch.constraints;
  if (patch.lastEvaluatedAt !== undefined) update.last_evaluated_at = patch.lastEvaluatedAt;
  if (patch.metadata !== undefined) update.metadata = patch.metadata;
  return update;
}
