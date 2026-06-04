export type GoalContextGoal = {
  id: string;
  user_id: string;
  title: string;
  subject?: string | null;
  domain?: string | null;
  exam_type?: string | null;
  preset_id?: string | null;
  target_level?: string | null;
  description?: string | null;
  target_date?: string | null;
  deadline?: string | null;
  progress?: number | null;
  status?: string | null;
  primary_chat_session_id?: string | null;
  last_active_at?: string | null;
  metadata?: Record<string, any> | null;
};

export type GoalContextSession = {
  id: string;
  user_id: string;
  title?: string | null;
  goal_id?: string | null;
  is_primary_for_goal?: boolean | null;
  session_type?: string | null;
  is_global?: boolean | null;
  archived_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export const GOAL_SELECT =
  'id, user_id, title, subject, domain, exam_type, preset_id, target_level, description, target_date, progress, status, primary_chat_session_id, last_active_at, metadata, created_at, updated_at';

export const SESSION_SELECT =
  'id, user_id, title, goal_id, is_primary_for_goal, session_type, is_global, archived_at, created_at, updated_at';

export async function getGoalForUser(
  supabase: any,
  userId: string,
  goalId: string
): Promise<GoalContextGoal | null> {
  if (!goalId) return null;

  const { data, error } = await supabase
    .from('learning_goals')
    .select(GOAL_SELECT)
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load learning goal: ${error.message}`);
  return data ?? null;
}

export async function ensureGoalForUser(
  supabase: any,
  userId: string,
  goalId: string
): Promise<GoalContextGoal> {
  const goal = await getGoalForUser(supabase, userId, goalId);
  if (!goal) throw new Error('Learning goal not found.');
  return goal;
}

export async function ensureSessionBelongsToUser(
  supabase: any,
  userId: string,
  chatId: string
): Promise<GoalContextSession> {
  const { data, error } = await supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .eq('id', chatId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to load chat session: ${error.message}`);
  if (!data || data.archived_at) throw new Error('Chat session not found.');
  return data;
}

export async function getOrCreatePrimaryGoalSession(
  supabase: any,
  userId: string,
  goalId: string
): Promise<GoalContextSession> {
  const goal = await ensureGoalForUser(supabase, userId, goalId);

  if (goal.primary_chat_session_id) {
    const { data: primary } = await supabase
      .from('chat_sessions')
      .select(SESSION_SELECT)
      .eq('id', goal.primary_chat_session_id)
      .eq('user_id', userId)
      .is('archived_at', null)
      .maybeSingle();

    if (primary) return primary;
  }

  const { data: existing, error: existingError } = await supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .eq('is_primary_for_goal', true)
    .is('archived_at', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw new Error(`Failed to load goal chat session: ${existingError.message}`);

  if (existing) {
    await supabase
      .from('learning_goals')
      .update({
        primary_chat_session_id: existing.id,
        last_active_at: new Date().toISOString(),
      })
      .eq('id', goalId)
      .eq('user_id', userId);
    return existing;
  }

  const title = `${goal.title} AI Tutor`;
  const { data: created, error: createError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      title,
      session_type: 'goal',
      is_global: false,
      goal_id: goalId,
      is_primary_for_goal: true,
    })
    .select(SESSION_SELECT)
    .single();

  if (createError) {
    if (createError.code === '23505') {
      const { data: raced } = await supabase
        .from('chat_sessions')
        .select(SESSION_SELECT)
        .eq('user_id', userId)
        .eq('goal_id', goalId)
        .eq('is_primary_for_goal', true)
        .is('archived_at', null)
        .maybeSingle();
      if (raced) return raced;
    }
    throw new Error(`Failed to create goal chat session: ${createError.message}`);
  }

  await supabase
    .from('learning_goals')
    .update({
      primary_chat_session_id: created.id,
      last_active_at: new Date().toISOString(),
    })
    .eq('id', goalId)
    .eq('user_id', userId);

  return created;
}

export async function ensureSessionGoalLink(
  supabase: any,
  userId: string,
  chatId: string,
  goalId: string
): Promise<GoalContextSession> {
  await ensureGoalForUser(supabase, userId, goalId);
  const session = await ensureSessionBelongsToUser(supabase, userId, chatId);

  if (session.goal_id && session.goal_id !== goalId) {
    throw new Error('Chat session belongs to a different learning goal.');
  }

  if (session.goal_id === goalId) return session;
  if (session.is_global) {
    throw new Error('Global chat cannot be reassigned to a learning goal.');
  }

  const { data, error } = await supabase
    .from('chat_sessions')
    .update({
      goal_id: goalId,
      session_type: session.session_type === 'global' ? 'goal' : session.session_type ?? 'thread',
      is_global: false,
    })
    .eq('id', chatId)
    .eq('user_id', userId)
    .select(SESSION_SELECT)
    .single();

  if (error || !data) throw new Error(`Failed to link chat session to goal: ${error?.message ?? 'missing session'}`);
  return data;
}

export async function resolveChatGoalContext(
  supabase: any,
  userId: string,
  input: { goalId?: string | null; chatId?: string | null }
): Promise<{
  goal: GoalContextGoal | null;
  goalId: string | null;
  session: GoalContextSession;
  sessionId: string;
}> {
  let goal: GoalContextGoal | null = null;
  let session: GoalContextSession | null = null;

  if (input.chatId) {
    session = await ensureSessionBelongsToUser(supabase, userId, input.chatId);
  }

  if (session?.goal_id) {
    if (input.goalId && input.goalId !== session.goal_id) {
      throw new Error('Selected chat does not belong to the selected learning goal.');
    }
    goal = await ensureGoalForUser(supabase, userId, session.goal_id);
  } else if (input.goalId) {
    goal = await ensureGoalForUser(supabase, userId, input.goalId);
    if (session && !session.is_global) {
      session = await ensureSessionGoalLink(supabase, userId, session.id, goal.id);
    } else {
      session = await getOrCreatePrimaryGoalSession(supabase, userId, goal.id);
    }
  }

  if (!session) {
    const { getOrCreateGlobalChatSession } = await import('@/lib/services/chat-persistence');
    const sessionId = await getOrCreateGlobalChatSession(supabase, userId);
    session = await ensureSessionBelongsToUser(supabase, userId, sessionId);
  }

  return {
    goal,
    goalId: goal?.id ?? null,
    session,
    sessionId: session.id,
  };
}

export async function getActiveGoalContext(
  supabase: any,
  userId: string,
  goalId: string
) {
  const goal = await ensureGoalForUser(supabase, userId, goalId);
  const now = new Date().toISOString();
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86_400_000).toISOString();
  const today = new Date().toISOString().split('T')[0];

  const [
    sourcesReady,
    sourcesProcessing,
    dueCards,
    weakConcepts,
    recentMistakes,
    microtasksPending,
    nextAction,
  ] = await Promise.all([
    supabase.from('study_materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', goalId).eq('status', 'ready'),
    supabase.from('study_materials').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', goalId).in('status', ['uploaded', 'processing']),
    supabase.from('revision_cards').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', goalId).lte('due', now),
    supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', goalId).in('mastery', ['not_started', 'exposed', 'developing']),
    supabase.from('mistakes').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', goalId).gte('created_at', fourteenDaysAgo),
    supabase.from('daily_microtasks').select('id', { count: 'exact', head: true }).eq('user_id', userId).eq('goal_id', goalId).eq('task_date', today).eq('status', 'pending'),
    supabase
      .from('daily_microtasks')
      .select('id, title, subject, topic, estimated_minutes, priority, status')
      .eq('user_id', userId)
      .eq('goal_id', goalId)
      .eq('task_date', today)
      .eq('status', 'pending')
      .order('priority', { ascending: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ]);

  return {
    goal,
    counts: {
      sourcesReady: sourcesReady.count ?? 0,
      sourcesProcessing: sourcesProcessing.count ?? 0,
      dueCards: dueCards.count ?? 0,
      weakConcepts: weakConcepts.count ?? 0,
      recentMistakes: recentMistakes.count ?? 0,
      microtasksPending: microtasksPending.count ?? 0,
    },
    nextAction: nextAction.data ?? null,
  };
}
