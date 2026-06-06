import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = {
  from: (table: string) => any;
};

type RepositoryOptions = {
  client?: SupabaseLike;
};

export type AmauraTaskInput = {
  userId: string;
  goalId?: string | null;
  title: string;
  subject?: string | null;
  topic?: string | null;
  conceptId?: string | null;
  type?: string;
  estimatedMinutes?: number;
  targetCount?: number | null;
  priority?: number | 'low' | 'medium' | 'high' | 'critical';
  taskDate?: string | null;
  scheduledFor?: string | null;
  sourceAgent?: string | null;
  sourceEventId?: string | null;
  dedupKey?: string | null;
  successCriteria?: Record<string, unknown>;
  result?: Record<string, unknown>;
  adaptationReason?: string | null;
  metadata?: Record<string, unknown>;
};

function client(options: RepositoryOptions = {}) {
  return options.client ?? createAdminClient();
}

export async function createTask(input: AmauraTaskInput, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .insert(toTaskRow(input))
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function createTaskIfNotExists(input: AmauraTaskInput, options: RepositoryOptions = {}) {
  const supabase = client(options);
  if (input.dedupKey) {
    const existing = await supabase
      .from('daily_microtasks')
      .select('*')
      .eq('user_id', input.userId)
      .eq('dedup_key', input.dedupKey)
      .maybeSingle();

    if (existing.error) throw existing.error;
    if (existing.data) return existing.data;
  }

  return createTask(input, { client: supabase });
}

export async function createTasksBulk(tasks: AmauraTaskInput[], options: RepositoryOptions = {}) {
  const created: any[] = [];
  for (const task of tasks) {
    created.push(await createTaskIfNotExists(task, options));
  }
  return created;
}

export async function listTasksForGoal(goalId: string, userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listTodayTasks(userId: string, options: RepositoryOptions = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .select('*')
    .eq('user_id', userId)
    .eq('task_date', today)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function listOverdueTasks(userId: string, options: RepositoryOptions = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'pending')
    .lt('task_date', today)
    .order('task_date', { ascending: true })
    .limit(50);

  if (error) throw error;
  return data ?? [];
}

export async function listPendingTasksForGoal(goalId: string, userId: string, options: RepositoryOptions = {}) {
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .select('*')
    .eq('goal_id', goalId)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('task_date', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function updateTaskStatus(
  taskId: string,
  userId: string,
  status: 'pending' | 'done' | 'skipped',
  evidence?: Record<string, unknown>,
  options: RepositoryOptions = {}
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    status,
    updated_at: now,
    result: evidence ?? {},
  };
  if (status === 'done') patch.completed_at = now;
  if (status === 'skipped') patch.skipped_at = now;

  const { data, error } = await client(options)
    .from('daily_microtasks')
    .update(patch)
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function completeTask(
  taskId: string,
  userId: string,
  result?: Record<string, unknown>,
  options: RepositoryOptions = {}
) {
  return updateTaskStatus(taskId, userId, 'done', result, options);
}

export async function skipTask(
  taskId: string,
  userId: string,
  reason?: string,
  options: RepositoryOptions = {}
) {
  return updateTaskStatus(taskId, userId, 'skipped', { reason: reason ?? null }, options);
}

export async function rescheduleTask(
  taskId: string,
  userId: string,
  scheduledFor: string,
  reason?: string,
  options: RepositoryOptions = {}
) {
  const date = scheduledFor.slice(0, 10);
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .update({
      task_date: date,
      scheduled_for: scheduledFor,
      adaptation_reason: reason ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function serviceListDueTasks(limit = 50, options: RepositoryOptions = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await client(options)
    .from('daily_microtasks')
    .select('*')
    .eq('status', 'pending')
    .lte('task_date', today)
    .order('task_date', { ascending: true })
    .limit(Math.max(1, Math.min(limit, 200)));

  if (error) throw error;
  return data ?? [];
}

export async function serviceCreateRepairTask(input: AmauraTaskInput, options: RepositoryOptions = {}) {
  return createTaskIfNotExists({
    ...input,
    type: input.type ?? 'weak_concept_repair',
    priority: input.priority ?? 'high',
    sourceAgent: input.sourceAgent ?? 'amaura_plan_adapter',
  }, options);
}

function toTaskRow(input: AmauraTaskInput) {
  const today = new Date().toISOString().slice(0, 10);
  const sourceAgent = input.sourceAgent ?? 'amaura';
  return {
    user_id: input.userId,
    goal_id: input.goalId ?? null,
    session_card_id: null,
    task_date: input.taskDate ?? input.scheduledFor?.slice(0, 10) ?? today,
    title: input.title,
    subject: input.subject ?? null,
    topic: input.topic ?? null,
    concept_id: input.conceptId ?? null,
    type: input.type ?? 'custom',
    estimated_minutes: Math.max(5, Math.min(input.estimatedMinutes ?? 15, 90)),
    target_count: input.targetCount ?? null,
    status: 'pending',
    priority: normalizePriority(input.priority),
    source: sourceAgent,
    source_agent: sourceAgent,
    source_event_id: input.sourceEventId ?? null,
    dedup_key: input.dedupKey ?? null,
    success_criteria: input.successCriteria ?? {},
    result: input.result ?? {},
    adaptation_reason: input.adaptationReason ?? null,
    scheduled_for: input.scheduledFor ?? null,
    updated_at: new Date().toISOString(),
    metadata: {
      ...(input.metadata ?? {}),
      dedupKey: input.dedupKey ?? null,
      sourceEventId: input.sourceEventId ?? null,
    },
  };
}

function normalizePriority(priority: AmauraTaskInput['priority']) {
  if (typeof priority === 'string') return priority;
  if (typeof priority === 'number') {
    if (priority <= 2) return 'critical';
    if (priority <= 4) return 'high';
    if (priority <= 7) return 'medium';
  }
  return 'low';
}
