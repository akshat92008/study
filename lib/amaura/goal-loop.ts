import { agentRuntimeEnabled } from './agents/budget';
import { createAdminClient } from '@/lib/supabase/admin';

type SupabaseLike = {
  from: (table: string) => any;
};

export type AmauraGoalLoopInput = {
  client: SupabaseLike;
  userId: string;
  title: string;
  now?: Date;
};

export type AmauraTaskCompletionInput = {
  client?: SupabaseLike;
  userId: string;
  goalId: string;
  taskId: string;
  now?: Date;
  outcome?: {
    confidence?: 'low' | 'medium' | 'high';
    weakTopic?: string | null;
    score?: number | null;
    notes?: string | null;
  };
};

export type AmauraExistingGoalLoopInput = {
  client?: SupabaseLike;
  userId: string;
  goalId: string;
  now?: Date;
  source?: string;
  sourceEventId?: string | null;
};

type ParsedGoal = {
  focusTopic: string;
  subject: string;
  targetDate: string | null;
};

export async function createAmauraGoalLoop(input: AmauraGoalLoopInput) {
  // Compatibility helper for tests and older API paths. The main architecture is
  // now repositories + native agents + the Amaura event matrix.
  const now = input.now ?? new Date();
  const parsed = parseGoal(input.title, now);
  const goal = await getOrCreateGoal(input.client, {
    userId: input.userId,
    title: input.title,
    parsed,
    now,
  });

  const tasks = await ensureInitialGoalTasks(input.client, {
    userId: input.userId,
    goal,
    parsed,
    now,
  });

  const primaryTask = tasks.find((task: any) => task.status === 'pending') ?? tasks[0] ?? null;
  if (primaryTask) {
    await upsertSessionCard(input.client, {
      userId: input.userId,
      goal,
      task: primaryTask,
      date: toDateKey(now),
      reason: `Goal decomposer chose ${primaryTask.title} as the first mission.`,
    });
  }

  const notification = await ensureNotification(input.client, {
    userId: input.userId,
    goalId: goal.id,
    type: 'goal_decomposed',
    priority: 'normal',
    title: 'Goal plan ready',
    message: `I created the first tasks for ${goal.title}. Start with ${primaryTask?.title ?? parsed.focusTopic}.`,
    actionType: 'open_goal',
    actionLabel: 'Open goal',
    dedupKey: `amaura:goal-decomposer:${goal.id}:v1`,
    metadata: { taskCount: tasks.length },
    now,
  });

  await recordAgentRun(input.client, {
    userId: input.userId,
    goalId: goal.id,
    agentName: 'GoalDecomposerAgent',
    eventType: 'AMAURA_GOAL_CREATED',
    dedupKey: `goal_decomposer:${goal.id}:v1`,
    input: { title: input.title },
    output: {
      actionsTaken: tasks.length + (notification ? 1 : 0) + (primaryTask ? 1 : 0),
      tasksCreated: tasks.length,
      notificationsCreated: notification ? 1 : 0,
      sessionCardUpdated: Boolean(primaryTask),
    },
    now,
  });

  return { goal, tasks, notification, nextAction: primaryTask };
}

export async function createAmauraGoalLoopForExistingGoal(input: AmauraExistingGoalLoopInput) {
  // Compatibility helper for real goal creation. It attaches decomposition to an
  // existing canonical learning_goals row instead of creating a duplicate goal.
  if (!agentRuntimeEnabled()) {
    return {
      skipped: true,
      reason: 'Amaura agent runtime is disabled.',
      goal: null,
      tasks: [],
      notification: null,
      nextAction: null,
    };
  }

  const now = input.now ?? new Date();
  const loopClient = input.client ?? createAdminClient();
  const goal = await loadGoal(loopClient, input.userId, input.goalId);
  if (!goal) throw new Error('Amaura goal loop goal not found.');
  const parsed = parseGoal(goal.title ?? 'Learning goal', now);

  const tasks = await ensureInitialGoalTasks(loopClient, {
    userId: input.userId,
    goal,
    parsed,
    now,
  });
  const primaryTask = tasks.find((task: any) => task.status === 'pending') ?? tasks[0] ?? null;

  if (primaryTask) {
    await upsertSessionCard(loopClient, {
      userId: input.userId,
      goal,
      task: primaryTask,
      date: toDateKey(now),
      reason: `Goal decomposer chose ${primaryTask.title} as the first mission.`,
    });
  }

  const notification = await ensureNotification(loopClient, {
    userId: input.userId,
    goalId: goal.id,
    type: 'goal_decomposed',
    priority: 'normal',
    title: 'Goal plan ready',
    message: `I created the first tasks for ${goal.title}. Start with ${primaryTask?.title ?? parsed.focusTopic}.`,
    actionType: 'open_goal',
    actionLabel: 'Open goal',
    dedupKey: `amaura:goal-decomposer:${goal.id}:v1`,
    metadata: {
      taskCount: tasks.length,
      source: input.source ?? 'compatibility',
      sourceEventId: input.sourceEventId ?? null,
    },
    now,
  });

  await recordAgentRun(loopClient, {
    userId: input.userId,
    goalId: goal.id,
    agentName: 'GoalDecomposerAgent',
    eventType: 'AMAURA_GOAL_CREATED',
    dedupKey: `goal_decomposer:${goal.id}:v1`,
    input: { goalId: goal.id, source: input.source ?? null, sourceEventId: input.sourceEventId ?? null },
    output: {
      actionsTaken: tasks.length + (notification ? 1 : 0) + (primaryTask ? 1 : 0),
      tasksCreated: tasks.length,
      notificationsCreated: notification ? 1 : 0,
      sessionCardUpdated: Boolean(primaryTask),
    },
    now,
  });

  if (primaryTask) {
    await recordAgentRun(loopClient, {
      userId: input.userId,
      goalId: goal.id,
      agentName: 'NextActionAgent',
      eventType: 'AMAURA_GOAL_CREATED',
      dedupKey: `next_action:${goal.id}:v1`,
      input: { goalId: goal.id },
      output: {
        actionsTaken: 1,
        sessionCardUpdated: true,
        nextActionId: primaryTask.id,
      },
      now,
    });
  }

  return { goal, tasks, notification, nextAction: primaryTask };
}

export async function completeAmauraGoalLoopTask(input: AmauraTaskCompletionInput) {
  const now = input.now ?? new Date();
  const loopClient = input.client ?? createAdminClient();
  const task = await loadTask(loopClient, input.userId, input.taskId);
  if (!task || task.goal_id !== input.goalId) {
    throw new Error('Amaura goal loop task not found.');
  }

  const completedTask = task.status === 'done'
    ? task
    : await updateTaskStatus(loopClient, input.userId, input.taskId, 'done', now);

  const observation = await ensureLearningEvidence(loopClient, {
    userId: input.userId,
    goalId: input.goalId,
    task: completedTask,
    outcome: input.outcome ?? {},
    now,
  });

  const goal = await loadGoal(loopClient, input.userId, input.goalId);
  if (!goal) throw new Error('Amaura goal loop goal not found.');

  const allTasks = await listGoalTasks(loopClient, input.userId, input.goalId);
  const completedCount = allTasks.filter((row: any) => row.status === 'done').length;
  const progressPercent = allTasks.length > 0
    ? Math.min(100, Math.round((completedCount / allTasks.length) * 100))
    : 0;

  const weakTopic = input.outcome?.weakTopic?.trim() || null;
  const adaptedTask = weakTopic
    ? await ensureAdaptedRepairTask(loopClient, {
        userId: input.userId,
        goal,
        weakTopic,
        sourceTaskId: input.taskId,
        now,
      })
    : null;

  const nextAction = adaptedTask ?? await chooseNextPendingTask(loopClient, input.userId, input.goalId);
  await updateGoalProgress(loopClient, {
    userId: input.userId,
    goal,
    progressPercent,
    nextAction,
    weakTopic,
    now,
  });

  if (nextAction) {
    await upsertSessionCard(loopClient, {
      userId: input.userId,
      goal,
      task: nextAction,
      date: toDateKey(now),
      reason: adaptedTask
        ? `Plan adapter moved ${nextAction.title} next because ${weakTopic} needs repair.`
        : `Progress evaluator selected ${nextAction.title} as the next mission.`,
    });
  }

  const notification = adaptedTask
    ? await ensureNotification(loopClient, {
        userId: input.userId,
        goalId: input.goalId,
        type: 'plan_adapted',
        priority: 'important',
        title: 'Plan adapted',
        message: `I added ${adaptedTask.title} after your latest task evidence. Do it next before moving on.`,
        actionType: 'open_mission',
        actionLabel: 'Open mission',
        dedupKey: `amaura:plan-adapter:${input.taskId}:v1`,
        metadata: { sourceTaskId: input.taskId, weakTopic },
        now,
      })
    : null;

  await recordAgentRun(loopClient, {
    userId: input.userId,
    goalId: input.goalId,
    agentName: 'ProgressEvaluatorAgent',
    eventType: 'AMAURA_TASK_COMPLETED',
    dedupKey: `progress_evaluator:${input.taskId}:v1`,
    input: { taskId: input.taskId },
    output: {
      actionsTaken: 1,
      observationRecorded: Boolean(observation),
      progressPercent,
    },
    now,
  });

  await recordAgentRun(loopClient, {
    userId: input.userId,
    goalId: input.goalId,
    agentName: 'PlanAdapterAgent',
    eventType: 'AMAURA_TASK_COMPLETED',
    dedupKey: `plan_adapter:${input.taskId}:v1`,
    input: { taskId: input.taskId, weakTopic },
    output: {
      actionsTaken: adaptedTask ? 1 : 0,
      tasksCreated: adaptedTask ? 1 : 0,
      skipped: !adaptedTask,
      skipReason: adaptedTask ? null : 'No plan adaptation needed.',
    },
    now,
  });

  await recordAgentRun(loopClient, {
    userId: input.userId,
    goalId: input.goalId,
    agentName: 'NextActionAgent',
    eventType: 'AMAURA_TASK_COMPLETED',
    dedupKey: `next_action:${input.taskId}:v1`,
    input: { taskId: input.taskId },
    output: {
      actionsTaken: nextAction ? 1 : 0,
      sessionCardUpdated: Boolean(nextAction),
      nextActionId: nextAction?.id ?? null,
    },
    now,
  });

  return {
    completedTask,
    observation,
    progressPercent,
    adaptedTask,
    nextAction,
    notification,
  };
}

function parseGoal(title: string, now: Date): ParsedGoal {
  const daysMatch = title.match(/\bin\s+(\d{1,3})\s+days?\b/i);
  const days = daysMatch ? Number(daysMatch[1]) : null;
  const focusMatch = title.match(/\bmaster\s+(.+?)(?:\s+in\s+\d{1,3}\s+days?\b|$)/i);
  const focusTopic = cleanTitle(focusMatch?.[1] ?? title);
  const subject = inferSubject(focusTopic);
  const targetDate = days && Number.isFinite(days)
    ? addDays(now, days).toISOString()
    : null;

  return { focusTopic, subject, targetDate };
}

async function getOrCreateGoal(client: SupabaseLike, input: {
  userId: string;
  title: string;
  parsed: ParsedGoal;
  now: Date;
}) {
  const existing = await client
    .from('learning_goals')
    .select('*')
    .eq('user_id', input.userId)
    .eq('title', input.title)
    .eq('status', 'active')
    .maybeSingle();

  if (existing.data) return existing.data;
  if (existing.error) throw existing.error;

  const inserted = await client
    .from('learning_goals')
    .insert({
      user_id: input.userId,
      title: input.title,
      subject: input.parsed.subject,
      domain: 'exam_prep',
      exam_type: 'NEET',
      target_date: input.parsed.targetDate,
      progress: 0,
      status: 'active',
      last_active_at: input.now.toISOString(),
      metadata: {
        amaura_goal_loop: {
          focusTopic: input.parsed.focusTopic,
          createdBy: 'GoalDecomposerAgent',
        },
      },
    })
    .select('*')
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function ensureInitialGoalTasks(client: SupabaseLike, input: {
  userId: string;
  goal: any;
  parsed: ParsedGoal;
  now: Date;
}) {
  const existing = await client
    .from('daily_microtasks')
    .select('*')
    .eq('user_id', input.userId)
    .eq('goal_id', input.goal.id)
    .eq('source', 'amaura_goal_decomposer')
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (existing.error) throw existing.error;
  if ((existing.data ?? []).length > 0) return existing.data;

  const topic = input.parsed.focusTopic;
  const rows = [
    {
      title: `Map the scope for ${topic}`,
      type: 'concept',
      estimated_minutes: 15,
      priority: 'high',
      dayOffset: 0,
    },
    {
      title: `Practice core ${topic} questions`,
      type: 'practice',
      estimated_minutes: 25,
      priority: 'medium',
      dayOffset: 1,
    },
    {
      title: `Review mistakes in ${topic}`,
      type: 'revision',
      estimated_minutes: 20,
      priority: 'medium',
      dayOffset: 2,
    },
  ].map((task) => ({
    user_id: input.userId,
    goal_id: input.goal.id,
    session_card_id: null,
    task_date: toDateKey(addDays(input.now, task.dayOffset)),
    title: task.title,
    subject: input.parsed.subject,
    topic,
    concept_id: null,
    type: task.type,
    estimated_minutes: task.estimated_minutes,
    target_count: null,
    status: 'pending',
    priority: task.priority,
    source: 'amaura_goal_decomposer',
    metadata: {
      agent: 'GoalDecomposerAgent',
      dedupKey: `goal_decomposer:${input.goal.id}:v1:${task.dayOffset}`,
    },
  }));

  const inserted = await client
    .from('daily_microtasks')
    .insert(rows)
    .select('*');

  if (inserted.error) throw inserted.error;
  return inserted.data ?? [];
}

async function loadTask(client: SupabaseLike, userId: string, taskId: string) {
  const result = await client
    .from('daily_microtasks')
    .select('*')
    .eq('id', taskId)
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

async function updateTaskStatus(
  client: SupabaseLike,
  userId: string,
  taskId: string,
  status: 'done' | 'skipped',
  now: Date
) {
  const result = await client
    .from('daily_microtasks')
    .update({
      status,
      completed_at: status === 'done' ? now.toISOString() : null,
    })
    .eq('id', taskId)
    .eq('user_id', userId)
    .select('*')
    .single();

  if (result.error) throw result.error;
  return result.data;
}

async function ensureLearningEvidence(client: SupabaseLike, input: {
  userId: string;
  goalId: string;
  task: any;
  outcome: NonNullable<AmauraTaskCompletionInput['outcome']>;
  now: Date;
}) {
  const sourceId = `daily_microtask:${input.task.id}:completion`;
  const existing = await client
    .from('learning_evidence')
    .select('*')
    .eq('user_id', input.userId)
    .eq('source_type', 'amaura_task_completion')
    .eq('source_id', sourceId)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await client
    .from('learning_evidence')
    .insert({
      user_id: input.userId,
      source_type: 'amaura_task_completion',
      source_id: sourceId,
      subject: input.task.subject ?? null,
      chapter: null,
      topic: input.outcome.weakTopic ?? input.task.topic ?? null,
      evidence_type: input.outcome.confidence === 'low' ? 'weakness' : 'completion',
      score: typeof input.outcome.score === 'number' ? input.outcome.score : null,
      confidence: input.outcome.confidence === 'low' ? 0.8 : 0.7,
      payload: {
        goalId: input.goalId,
        taskId: input.task.id,
        taskTitle: input.task.title,
        notes: input.outcome.notes ?? null,
        weakTopic: input.outcome.weakTopic ?? null,
      },
      created_at: input.now.toISOString(),
    })
    .select('*')
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function loadGoal(client: SupabaseLike, userId: string, goalId: string) {
  const result = await client
    .from('learning_goals')
    .select('*')
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

async function listGoalTasks(client: SupabaseLike, userId: string, goalId: string) {
  const result = await client
    .from('daily_microtasks')
    .select('*')
    .eq('user_id', userId)
    .eq('goal_id', goalId);

  if (result.error) throw result.error;
  return result.data ?? [];
}

async function ensureAdaptedRepairTask(client: SupabaseLike, input: {
  userId: string;
  goal: any;
  weakTopic: string;
  sourceTaskId: string;
  now: Date;
}) {
  const title = `Repair weak spot: ${input.weakTopic}`;
  const existing = await client
    .from('daily_microtasks')
    .select('*')
    .eq('user_id', input.userId)
    .eq('goal_id', input.goal.id)
    .eq('source', 'amaura_plan_adapter')
    .eq('title', title)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await client
    .from('daily_microtasks')
    .insert({
      user_id: input.userId,
      goal_id: input.goal.id,
      session_card_id: null,
      task_date: toDateKey(input.now),
      title,
      subject: input.goal.subject ?? inferSubject(input.weakTopic),
      topic: input.weakTopic,
      concept_id: null,
      type: 'weak_concept_repair',
      estimated_minutes: 18,
      target_count: null,
      status: 'pending',
      priority: 'high',
      source: 'amaura_plan_adapter',
      metadata: {
        agent: 'PlanAdapterAgent',
        sourceTaskId: input.sourceTaskId,
        adaptationReason: 'completed task reported low confidence evidence',
      },
    })
    .select('*')
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function chooseNextPendingTask(client: SupabaseLike, userId: string, goalId: string) {
  const result = await client
    .from('daily_microtasks')
    .select('*')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .eq('status', 'pending')
    .order('priority', { ascending: true })
    .order('task_date', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (result.error) throw result.error;
  return result.data;
}

async function updateGoalProgress(client: SupabaseLike, input: {
  userId: string;
  goal: any;
  progressPercent: number;
  nextAction: any;
  weakTopic: string | null;
  now: Date;
}) {
  const metadata = {
    ...(input.goal.metadata ?? {}),
    amaura_goal_loop: {
      ...(input.goal.metadata?.amaura_goal_loop ?? {}),
      progressPercent: input.progressPercent,
      riskLevel: input.weakTopic ? 'medium' : 'low',
      nextBestAction: input.nextAction
        ? {
            taskId: input.nextAction.id,
            title: input.nextAction.title,
            source: input.nextAction.source,
          }
        : null,
      blockers: input.weakTopic ? [input.weakTopic] : [],
      lastEvaluatedAt: input.now.toISOString(),
    },
  };

  const updated = await client
    .from('learning_goals')
    .update({
      progress: input.progressPercent,
      last_active_at: input.now.toISOString(),
      metadata,
    })
    .eq('id', input.goal.id)
    .eq('user_id', input.userId)
    .select('*')
    .single();

  if (updated.error) throw updated.error;
  return updated.data;
}

async function upsertSessionCard(client: SupabaseLike, input: {
  userId: string;
  goal: any;
  task: any;
  date: string;
  reason: string;
}) {
  const existing = await client
    .from('session_cards')
    .select('*')
    .eq('user_id', input.userId)
    .eq('goal_id', input.goal.id)
    .eq('date', input.date)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const row = {
    user_id: input.userId,
    goal_id: input.goal.id,
    date: input.date,
    learner_state_version: 0,
    dayNumber: 1,
    streakDays: 0,
    focusTopic: input.task.topic ?? input.task.title,
    subject: input.task.subject ?? input.goal.subject ?? 'General',
    estimatedMinutes: input.task.estimated_minutes ?? 15,
    rationale: input.reason,
    daysToExam: daysUntil(input.goal.target_date),
    overdueCards: 0,
    masteryPercent: input.goal.progress ?? 0,
    closingMessage: null,
    taskType: input.task.type,
    resourceType: input.task.type === 'practice' ? 'practice' : 'lesson',
    targetConceptId: input.task.concept_id ?? null,
    priority: input.task.priority ?? 'medium',
    isCompleted: false,
    completedAt: null,
    selectionReason: input.reason,
    mistakeCount: 0,
    weakConceptCount: input.task.source === 'amaura_plan_adapter' ? 1 : 0,
    hasActiveGoal: true,
  };

  const result = existing.data
    ? await client
        .from('session_cards')
        .update(row)
        .eq('id', existing.data.id)
        .select('*')
        .single()
    : await client
        .from('session_cards')
        .insert(row)
        .select('*')
        .single();

  if (result.error) throw result.error;
  return result.data;
}

async function ensureNotification(client: SupabaseLike, input: {
  userId: string;
  goalId: string;
  type: string;
  priority: string;
  title: string;
  message: string;
  actionType: string;
  actionLabel: string;
  dedupKey: string;
  metadata: Record<string, unknown>;
  now: Date;
}) {
  const existing = await client
    .from('amaura_notifications')
    .select('*')
    .eq('user_id', input.userId)
    .eq('dedup_key', input.dedupKey)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await client
    .from('amaura_notifications')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId,
      type: input.type,
      priority: input.priority,
      title: input.title,
      message: input.message,
      action_type: input.actionType,
      action_label: input.actionLabel,
      action_payload: { goalId: input.goalId },
      dedup_key: input.dedupKey,
      metadata: input.metadata,
      read: false,
      created_at: input.now.toISOString(),
      updated_at: input.now.toISOString(),
    })
    .select('*')
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

async function recordAgentRun(client: SupabaseLike, input: {
  userId: string;
  goalId: string;
  agentName: string;
  eventType: string;
  dedupKey: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  now: Date;
}) {
  const existing = await client
    .from('amaura_agent_runs')
    .select('*')
    .eq('user_id', input.userId)
    .eq('agent_name', input.agentName)
    .eq('dedup_key', input.dedupKey)
    .maybeSingle();

  if (existing.error) throw existing.error;
  if (existing.data) return existing.data;

  const inserted = await client
    .from('amaura_agent_runs')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId,
      agent_name: input.agentName,
      event_id: null,
      event_type: input.eventType,
      dedup_key: input.dedupKey,
      status: input.output.skipped ? 'skipped' : 'completed',
      input: input.input,
      output: input.output,
      started_at: input.now.toISOString(),
      finished_at: input.now.toISOString(),
      created_at: input.now.toISOString(),
      updated_at: input.now.toISOString(),
    })
    .select('*')
    .single();

  if (inserted.error) throw inserted.error;
  return inserted.data;
}

function cleanTitle(value: string) {
  return value.trim().replace(/[.?!]+$/g, '') || 'Learning goal';
}

function inferSubject(topic: string) {
  return /kinematics|motion|force|work|energy|physics/i.test(topic)
    ? 'Physics'
    : 'General';
}

function addDays(now: Date, days: number) {
  const date = new Date(now);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function daysUntil(value?: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}
