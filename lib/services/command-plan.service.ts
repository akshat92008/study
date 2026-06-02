import { createAdminClient } from '@/lib/supabase/admin';
import { OutcomeAnalyticsService, type OutcomeAnalyticsSummary } from '@/lib/services/outcome-analytics.service';
import { logger } from '@/lib/utils/logger';
import { recordAgentAction } from '@/lib/agents/agent-runtime';

type SupabaseLike = ReturnType<typeof createAdminClient> | any;

export type CommandPlanTask = {
  id?: string;
  user_id?: string;
  title: string;
  description?: string | null;
  type: 'study' | 'revision' | 'practice' | 'mock_test' | 'break' | 'review';
  subject?: string | null;
  chapter?: string | null;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimated_minutes: number;
  scheduled_date: string;
  notes?: string | null;
  is_completed?: boolean;
};

export type CommandPlanResult = {
  date: string;
  tasks: CommandPlanTask[];
  created: boolean;
  briefing: string;
  sourceSignals: {
    dueRevisionCount: number;
    weakAreaCount: number;
    recentMistakeCount: number;
    specificMemoryUsed: boolean;
    scoreTrend?: OutcomeAnalyticsSummary['scoreTrend'];
  };
};

type PlanState = {
  profile: any;
  dueCards: any[];
  weakConcepts: any[];
  recentMistakes: any[];
  recentEpisodes: string[];
  outcomeSummary: OutcomeAnalyticsSummary | null;
};

export function localDateAfter(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function ensureCommandPlanForDate(input: {
  userId: string;
  date: string;
  client?: SupabaseLike;
}): Promise<CommandPlanResult> {
  const supabase = input.client ?? createAdminClient();
  const existing = await loadExistingTasks(supabase, input.userId, input.date);
  const state = await loadPlanState(supabase, input.userId);

  if (existing.length > 0) {
    const briefing = buildMorningBriefing(state, existing, input.date);
    await persistDailyPlan(supabase, input.userId, input.date, existing, briefing, state, false);
    return {
      date: input.date,
      tasks: existing,
      created: false,
      briefing,
      sourceSignals: signalsFromState(state),
    };
  }

  const tasks = buildDeterministicPlan(input.userId, input.date, state);
  if (tasks.length > 0) {
    const { data, error } = await supabase
      .from('study_tasks')
      .insert(tasks)
      .select('*');

    if (error) {
      logger.error('COMMAND daily plan task insert failed', {
        userId: input.userId,
        date: input.date,
        error: error.message,
      });
      throw new Error(`COMMAND daily plan failed: ${error.message}`);
    }

    const persistedTasks = (data ?? tasks) as CommandPlanTask[];
    const briefing = buildMorningBriefing(state, persistedTasks, input.date);
    await persistDailyPlan(supabase, input.userId, input.date, persistedTasks, briefing, state, true);
    
    await recordAgentAction({
      userId: input.userId,
      agentName: 'command',
      actionType: 'plan_created',
      targetType: 'daily_plan',
      status: 'applied',
      riskLevel: 'safe_auto',
      confidence: 1.0,
      evidence: { date: input.date, tasks: persistedTasks.length, briefing },
      idempotencyKey: `command_plan_created:${input.userId}:${input.date}`,
    }, { client: supabase }).catch(err => logger.warn('Failed to record COMMAND action', err));

    return {
      date: input.date,
      tasks: persistedTasks,
      created: true,
      briefing,
      sourceSignals: signalsFromState(state),
    };
  }

  const briefing = buildMorningBriefing(state, [], input.date);
  await persistDailyPlan(supabase, input.userId, input.date, [], briefing, state, false);
  return {
    date: input.date,
    tasks: [],
    created: false,
    briefing,
    sourceSignals: signalsFromState(state),
  };
}

export async function runDailySynthesisForUser(input: {
  userId: string;
  date: string;
  client?: SupabaseLike;
}): Promise<CommandPlanResult> {
  return ensureCommandPlanForDate(input);
}

export function formatCommandPlanForChat(plan: CommandPlanResult): string {
  const taskLines = plan.tasks
    .filter((task) => task.type !== 'break')
    .slice(0, 5)
    .map((task, index) => {
      const topic = [task.subject, task.chapter].filter(Boolean).join(' / ');
      const where = topic ? ` - ${topic}` : '';
      return `${index + 1}. ${task.title}${where} (${task.estimated_minutes} min, ${task.priority})`;
    });

  const dueRevision = plan.sourceSignals.dueRevisionCount > 0
    ? `Due revision: ${plan.sourceSignals.dueRevisionCount} card(s).`
    : 'Due revision: no cards are due right now.';

  if (taskLines.length === 0) {
    return [
      `For ${plan.date}, I do not have enough learner evidence to build a targeted plan yet.`,
      'First action: upload a mock result, finish one session, or tell me your weakest chapter.',
      dueRevision,
    ].join('\n');
  }

  return [
    plan.briefing,
    '',
    `Plan for ${plan.date}:`,
    ...taskLines,
    dueRevision,
    `First action: ${plan.tasks[0].title}.`,
  ].join('\n');
}

export function formatWeakAreasForChat(input: {
  weakConcepts: Array<{ name?: string; subject?: string; chapter?: string; mastery?: string }>;
  recentMistakes?: Array<{ subject?: string; chapter?: string; category?: string }>;
  masteryPercent?: number;
}): string {
  const weak = input.weakConcepts.slice(0, 5);
  const mistakes = input.recentMistakes ?? [];

  if (weak.length === 0 && mistakes.length === 0) {
    return 'I do not have enough ATLAS or AUTOPSY evidence yet to name your weakest areas. Send a mock result, mistake list, or finish a few tutor sessions and I will rank them from real data.';
  }

  const lines = weak.map((concept, index) => {
    const label = concept.name || concept.chapter || 'Unknown area';
    const subject = concept.subject ? ` (${concept.subject})` : '';
    const chapter = concept.chapter && concept.chapter !== concept.name ? ` - ${concept.chapter}` : '';
    const mastery = concept.mastery ? ` - ${concept.mastery}` : '';
    return `${index + 1}. ${label}${subject}${chapter}${mastery}`;
  });

  const recentMistakeLine = mistakes.length > 0
    ? `Recent AUTOPSY signal: ${mistakes.slice(0, 3).map((m) => `${m.subject || 'Subject'} / ${m.chapter || 'Chapter'}${m.category ? ` (${m.category})` : ''}`).join('; ')}.`
    : 'Recent AUTOPSY signal: no verified mistakes recorded yet.';

  return [
    `ATLAS currently puts your mastery at ${input.masteryPercent ?? 0}%.`,
    'Weakest areas:',
    ...lines,
    recentMistakeLine,
  ].join('\n');
}

export function formatRevisionQueueForChat(input: {
  dueCount: number;
  cards: Array<{ front?: string; subject?: string; chapter?: string }>;
}): string {
  if (input.dueCount <= 0 || input.cards.length === 0) {
    return 'MEMORY has no due revision cards right now. Best next move: do one focused practice block or upload your latest mock so I can create evidence-backed cards.';
  }

  const cards = input.cards.slice(0, 5).map((card, index) => {
    const topic = [card.subject, card.chapter].filter(Boolean).join(' / ');
    return `${index + 1}. ${card.front || topic || 'Revision card'}`;
  });

  return [
    `MEMORY has ${input.dueCount} card(s) due now.`,
    'Revise these first:',
    ...cards,
    'Stop after the due queue or 25 minutes, whichever comes first.',
  ].join('\n');
}

async function loadExistingTasks(supabase: SupabaseLike, userId: string, date: string): Promise<CommandPlanTask[]> {
  const { data, error } = await supabase
    .from('study_tasks')
    .select('*')
    .eq('user_id', userId)
    .eq('scheduled_date', date)
    .order('priority', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    logger.warn('COMMAND failed to read existing study tasks', { userId, date, error: error.message });
    return [];
  }
  return (data ?? []) as CommandPlanTask[];
}

async function loadPlanState(supabase: SupabaseLike, userId: string): Promise<PlanState> {
  const now = new Date().toISOString();
  const [
    profileRes,
    dueCardsRes,
    weakConceptsRes,
    mistakesRes,
    episodesRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('exam_type, target_date, target_score, current_level, daily_hours, daily_hours_available, emotional_state, timezone')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('revision_cards')
      .select('id, front, subject, chapter, difficulty, lapses, due')
      .eq('user_id', userId)
      .lte('due', now)
      .neq('state', 4)
      .order('due', { ascending: true })
      .limit(20),
    supabase
      .from('concepts')
      .select('id, name, subject, chapter, mastery, forgetting_probability')
      .eq('user_id', userId)
      .in('mastery', ['not_started', 'exposed', 'developing'])
      .order('forgetting_probability', { ascending: false })
      .limit(10),
    supabase
      .from('mistakes')
      .select('id, subject, chapter, category, marks_lost, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
    supabase
      .from('episodic_memories')
      .select('summary')
      .eq('user_id', userId)
      .order('retrieval_weight', { ascending: false })
      .limit(2),
  ]);

  let outcomeSummary: OutcomeAnalyticsSummary | null = null;
  try {
    outcomeSummary = await new OutcomeAnalyticsService(supabase).getSummary(userId);
  } catch (err) {
    logger.warn('COMMAND outcome summary unavailable', { userId, err });
  }

  return {
    profile: profileRes.data ?? null,
    dueCards: dueCardsRes.data ?? [],
    weakConcepts: weakConceptsRes.data ?? [],
    recentMistakes: mistakesRes.data ?? [],
    recentEpisodes: (episodesRes.data ?? []).map((row: any) => row.summary).filter(Boolean),
    outcomeSummary,
  };
}

function buildDeterministicPlan(userId: string, date: string, state: PlanState): CommandPlanTask[] {
  const dailyHours = Number(
    state.profile?.daily_hours_available ??
    state.profile?.daily_hours ??
    4
  );
  const maxMinutes = Math.max(60, Math.min(10 * 60, Math.round(dailyHours * 60)));
  const focusBlock = state.profile?.emotional_state === 'overwhelmed' ? 25 : 45;
  const tasks: CommandPlanTask[] = [];
  let used = 0;

  const addTask = (task: Omit<CommandPlanTask, 'scheduled_date' | 'is_completed'>) => {
    if (used + task.estimated_minutes > maxMinutes) return;
    tasks.push({
      ...task,
      scheduled_date: date,
      is_completed: false,
    });
    used += task.estimated_minutes;
  };

  if (state.dueCards.length > 0) {
    const first = state.dueCards[0];
    addTask({
      user_id: userId,
      title: `Revise due MEMORY cards: ${first.chapter || first.subject || 'mixed topics'}`,
      description: `Clear ${Math.min(state.dueCards.length, 30)} due spaced-repetition cards.`,
      type: 'revision',
      subject: first.subject ?? null,
      chapter: first.chapter ?? null,
      priority: 'critical',
      estimated_minutes: Math.min(30, focusBlock),
      notes: 'COMMAND selected this because MEMORY has cards due now.',
    } as any);
  }

  const mistakeGroups = groupBySubjectChapter(state.recentMistakes);
  const topMistake = mistakeGroups[0];
  if (topMistake) {
    addTask({
      user_id: userId,
      title: `Repair AUTOPSY gap: ${topMistake.chapter}`,
      description: `Redo mistakes and one similar set for ${topMistake.chapter}.`,
      type: 'practice',
      subject: topMistake.subject,
      chapter: topMistake.chapter,
      priority: tasks.length === 0 ? 'critical' : 'high',
      estimated_minutes: focusBlock,
      notes: `COMMAND selected this from ${topMistake.count} verified mistake(s).`,
    } as any);
  }

  const weak = state.weakConcepts.find((concept) =>
    !topMistake ||
    concept.chapter !== topMistake.chapter ||
    concept.subject !== topMistake.subject
  ) ?? state.weakConcepts[0];
  if (weak) {
    addTask({
      user_id: userId,
      title: `ATLAS weak-area block: ${weak.name || weak.chapter}`,
      description: `Study the core idea, then solve targeted examples for ${weak.chapter}.`,
      type: 'study',
      subject: weak.subject,
      chapter: weak.chapter,
      priority: tasks.length === 0 ? 'critical' : 'high',
      estimated_minutes: focusBlock,
      notes: `COMMAND selected this because ATLAS marks it as ${weak.mastery}.`,
    } as any);
  }

  if (tasks.length === 0) {
    addTask({
      user_id: userId,
      title: 'Baseline evidence block',
      description: 'Complete one short diagnostic set or upload the latest mock result.',
      type: 'practice',
      subject: null,
      chapter: null,
      priority: 'medium',
      estimated_minutes: Math.min(45, focusBlock),
      notes: 'COMMAND needs more evidence before it can personalize deeper.',
    } as any);
  }

  if (used + 10 <= maxMinutes && tasks.some((task) => task.estimated_minutes >= 40)) {
    addTask({
      user_id: userId,
      title: 'Reset break',
      description: 'Walk, hydrate, and reset before the next block.',
      type: 'break',
      subject: null,
      chapter: null,
      priority: 'low',
      estimated_minutes: 10,
      notes: 'COMMAND pacing guardrail.',
    } as any);
  }

  return tasks;
}

function buildMorningBriefing(state: PlanState, tasks: CommandPlanTask[], date: string): string {
  const callback = state.recentEpisodes[0]
    ? `Last time: ${state.recentEpisodes[0]}`
    : null;
  const risk = state.recentMistakes.length > 0
    ? `Today's risk: repeating ${state.recentMistakes[0].chapter} mistakes.`
    : state.dueCards.length > 0
      ? `Today's risk: ${state.dueCards.length} due card(s) turning stale.`
      : 'Today’s risk: too little fresh evidence for personalization.';
  const first = tasks[0]?.title ?? 'Baseline evidence block';
  const due = state.dueCards.length > 0
    ? `Due revision: ${state.dueCards.length} card(s).`
    : 'Due revision: none due.';

  return [
    callback,
    risk,
    `Today's plan (${date}): ${tasks.filter((task) => task.type !== 'break').slice(0, 3).map((task) => task.title).join(' | ') || first}.`,
    due,
    `First action: ${first}.`,
  ].filter(Boolean).join(' ');
}

async function persistDailyPlan(
  supabase: SupabaseLike,
  userId: string,
  date: string,
  tasks: CommandPlanTask[],
  briefing: string,
  state: PlanState,
  created: boolean
) {
  const payload = {
    user_id: userId,
    plan_date: date,
    status: 'completed',
    morning_briefing: briefing,
    summary: {
      taskCount: tasks.length,
      created,
      dueRevisionCount: state.dueCards.length,
      weakAreaCount: state.weakConcepts.length,
      recentMistakeCount: state.recentMistakes.length,
      outcome: state.outcomeSummary,
    },
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('daily_plans')
    .upsert(payload, { onConflict: 'user_id,plan_date' });

  if (error) {
    logger.warn('COMMAND failed to persist daily_plans row', {
      userId,
      date,
      error: error.message,
    });
  }
}

function signalsFromState(state: PlanState): CommandPlanResult['sourceSignals'] {
  return {
    dueRevisionCount: state.dueCards.length,
    weakAreaCount: state.weakConcepts.length,
    recentMistakeCount: state.recentMistakes.length,
    specificMemoryUsed: state.recentEpisodes.length > 0,
    scoreTrend: state.outcomeSummary?.scoreTrend,
  };
}

function groupBySubjectChapter(rows: any[]) {
  const map = new Map<string, { subject: string; chapter: string; count: number; marksLost: number }>();
  for (const row of rows) {
    if (!row.subject || !row.chapter) continue;
    const key = `${row.subject}::${row.chapter}`;
    const existing = map.get(key) ?? {
      subject: row.subject,
      chapter: row.chapter,
      count: 0,
      marksLost: 0,
    };
    existing.count += 1;
    existing.marksLost += Number(row.marks_lost ?? 0);
    map.set(key, existing);
  }
  return [...map.values()].sort((a, b) => (b.marksLost - a.marksLost) || (b.count - a.count));
}
