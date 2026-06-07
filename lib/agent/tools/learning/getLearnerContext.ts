import type { AgentToolDefinition } from '@/lib/agent/types';
import { GetLearnerContextInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { getAvailableSources } from '@/lib/sources/getAvailableSources';

async function safe<T>(label: string, fn: () => any, warnings: string[]) {
  try {
    const result = await fn() as { data?: T; count?: number | null; error?: any };
    if (result.error) {
      warnings.push(`${label}: ${result.error.message ?? 'query failed'}`);
      return { data: undefined as T | undefined, count: result.count ?? null };
    }
    return { data: result.data, count: result.count ?? null };
  } catch (error) {
    warnings.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    return { data: undefined as T | undefined, count: null };
  }
}

export const getLearnerContextTool: AgentToolDefinition<typeof GetLearnerContextInputSchema, typeof ToolResultSchema> = {
  name: 'get_learner_context',
  description: 'Load durable learner profile, active goal, mission, ATLAS, MEMORY, sources, recent events, attempts, and mistakes.',
  inputSchema: GetLearnerContextInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 1,
  requiresAuth: true,
  async handler(input, context) {
    const warnings: string[] = [];
    const supabase = context.supabase;
    const goalId = input.goalId ?? context.goalId ?? null;
    const today = context.now.toISOString().slice(0, 10);
    const now = context.now.toISOString();

    const [
      profileRes,
      goalRes,
      missionRes,
      microtasksRes,
      conceptsRes,
      dueCardsRes,
      eventRes,
      actionRes,
      attemptsRes,
      mistakesRes,
    ] = await Promise.all([
      safe('profile', () => supabase.from('profiles').select('id, full_name, exam_type, streak_days, last_active_at, timezone, learner_state_version').eq('id', context.userId).maybeSingle(), warnings),
      safe('active goal', () => {
        let query = supabase.from('learning_goals').select('id, title, subject, domain, status, progress, target_date, updated_at').eq('user_id', context.userId);
        query = goalId ? query.eq('id', goalId) : query.eq('status', 'active').limit(1);
        return query.maybeSingle();
      }, warnings),
      safe('daily mission', () => {
        let query = supabase.from('session_cards').select('*').eq('user_id', context.userId).eq('date', today).limit(1);
        if (goalId) query = query.eq('goal_id', goalId);
        return query.maybeSingle();
      }, warnings),
      safe<any[]>('microtargets', () => {
        let query = supabase.from('daily_microtasks').select('*').eq('user_id', context.userId).eq('task_date', today).order('created_at', { ascending: true }).limit(12);
        if (goalId) query = query.eq('goal_id', goalId);
        return query;
      }, warnings),
      safe<any[]>('concepts', () => {
        let query = supabase.from('concepts').select('id, name, subject, chapter, topic, mastery, mastery_score, confidence, updated_at').eq('user_id', context.userId).order('updated_at', { ascending: false }).limit(60);
        if (goalId) query = query.eq('goal_id', goalId);
        return query;
      }, warnings),
      safe<any[]>('due cards', () => {
        let query = supabase.from('revision_cards').select('id, concept_id, front, subject, chapter, due, state, created_at', { count: 'exact' }).eq('user_id', context.userId).lte('due', now).neq('state', 4).order('due', { ascending: true }).limit(10);
        if (goalId) query = query.eq('goal_id', goalId);
        return query;
      }, warnings),
      safe<any[]>('recent learning signals', () => supabase.from('learning_signals').select('id, signal_type, source_type, subject, topic, confidence, created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(20), warnings),
      safe<any[]>('recent agent actions', () => supabase.from('agent_actions').select('id, agent_name, action_type, status, target_type, target_id, created_at, evidence').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(20), warnings),
      safe<any[]>('recent practice attempts', () => supabase.from('practice_attempts').select('id, practice_set_id, practice_item_id, is_correct, created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(20), warnings),
      safe<any[]>('recent mistakes', () => {
        let query = supabase.from('mistakes').select('id, concept_id, concept, subject, chapter, topic, category, status, mistake_text, created_at').eq('user_id', context.userId).order('created_at', { ascending: false }).limit(20);
        if (goalId) query = query.eq('goal_id', goalId);
        return query;
      }, warnings),
    ]);

    const sources = await getAvailableSources(supabase, context.userId).catch((error) => {
      warnings.push(`sources: ${error instanceof Error ? error.message : String(error)}`);
      return [];
    });

    const concepts = conceptsRes.data ?? [];
    const weakConcepts = concepts.filter((row: any) => ['not_started', 'weak', 'exposed', 'developing', 'learning'].includes(row.mastery));
    const learningConcepts = concepts.filter((row: any) => ['learning', 'developing', 'proficient'].includes(row.mastery));
    const strongConcepts = concepts.filter((row: any) => ['strong', 'ready', 'mastered', 'automated'].includes(row.mastery));

    const summary = {
      profile: profileRes.data as any,
      activeGoal: goalRes.data as any ?? null,
      dailyMission: missionRes.data as any ?? null,
      atlas: {
        weakConcepts,
        learningConcepts,
        strongConcepts,
        recentConcepts: concepts.slice(0, 8),
      },
      memory: {
        dueCount: dueCardsRes.count ?? (dueCardsRes.data ?? []).length,
        dueCards: dueCardsRes.data ?? [],
      },
      sources: {
        available: sources,
        availableCount: sources.length,
      },
      recent: {
        learningSignals: eventRes.data ?? [],
        agentActions: actionRes.data ?? [],
        practiceAttempts: attemptsRes.data ?? [],
        mistakes: mistakesRes.data ?? [],
        microtargets: microtasksRes.data ?? [],
      },
      warnings,
    };

    context.contextSummary = summary;

    return {
      success: true,
      changed: false,
      entityType: 'learner_context',
      entityIds: [context.userId],
      summary: `Loaded learner context with ${weakConcepts.length} weak concepts, ${sources.length} usable sources, and ${dueCardsRes.count ?? 0} due cards.`,
      data: summary,
    };
  },
};
