import { normalizeGoal, type NormalizedGoal } from '@/lib/goals/normalize-goal';
import { logger } from '@/lib/utils/logger';

export type TutorContext = {
  userId: string;
  activeGoalId: string | null;
  goalTitle: string | null;
  normalizedGoal: NormalizedGoal | null;
  exam: string | null;
  subject: string | null;
  chapter: string | null;
  chapterSlug: string | null;
  currentMissionId: string | null;
  currentMicrotargetId: string | null;
  sourceMaterialIds: string[];
  sourceStatuses: Array<{ id: string; status: string; title: string | null }>;
  recentWeakAreas: Array<{ concept_tag: string; severity: string; missing_points: string[] }>;
  recentQuestions: string[];
  userAnswerHistory: Array<{ question_id: string | null; user_answer: string; score: string }>;
  currentDate: string;
  timezone: string;
};

export async function loadTutorContext(input: {
  supabase: any;
  userId: string;
  activeGoalId?: string | null;
  requestId?: string | null;
}): Promise<TutorContext> {
  const { data: profile } = await input.supabase
    .from('profiles')
    .select('timezone, active_goal_id')
    .eq('id', input.userId)
    .maybeSingle();

  const goalId = input.activeGoalId ?? profile?.active_goal_id ?? null;
  if (!goalId) return emptyTutorContext(input.userId, profile?.timezone ?? 'UTC');

  const [{ data: goal }, { data: mission }, { data: sources }, { data: weakAreas }, { data: attempts }] = await Promise.all([
    input.supabase.from('learning_goals').select('id, title, subject, exam_type, target_level, metadata').eq('id', goalId).eq('user_id', input.userId).maybeSingle(),
    input.supabase.from('seeded_topics').select('id, topic, metadata').eq('goal_id', goalId).eq('user_id', input.userId).in('status', ['active', 'in_progress', 'not_started']).order('order_index', { ascending: true }).limit(1).maybeSingle(),
    input.supabase.from('study_materials').select('id, title, status').eq('goal_id', goalId).eq('user_id', input.userId).order('updated_at', { ascending: false }).limit(20),
    input.supabase.from('weak_area_events').select('concept_tag, severity, missing_points').eq('goal_id', goalId).eq('user_id', input.userId).is('resolved_at', null).order('created_at', { ascending: false }).limit(20),
    input.supabase.from('tutor_question_attempts').select('question_id, user_answer, score').eq('goal_id', goalId).eq('user_id', input.userId).order('created_at', { ascending: false }).limit(20),
  ]);

  if (!goal) return emptyTutorContext(input.userId, profile?.timezone ?? 'UTC');

  const metadataGoal = goal.metadata?.normalizedGoal as NormalizedGoal | undefined;
  const normalizedGoal = metadataGoal?.chapterSlug ? metadataGoal : normalizeGoal(goal.title ?? '');
  const timezone = profile?.timezone ?? 'UTC';
  const context: TutorContext = {
    userId: input.userId,
    activeGoalId: goal.id,
    goalTitle: goal.title,
    normalizedGoal,
    exam: normalizedGoal.exam ?? goal.exam_type ?? null,
    subject: normalizedGoal.subject ?? goal.subject ?? null,
    chapter: normalizedGoal.chapter,
    chapterSlug: normalizedGoal.chapterSlug,
    currentMissionId: mission?.id ?? null,
    currentMicrotargetId: mission?.id ?? null,
    sourceMaterialIds: (sources ?? []).map((source: any) => source.id),
    sourceStatuses: (sources ?? []).map((source: any) => ({ id: source.id, status: source.status, title: source.title ?? null })),
    recentWeakAreas: (weakAreas ?? []).map((area: any) => ({
      concept_tag: area.concept_tag,
      severity: area.severity,
      missing_points: Array.isArray(area.missing_points) ? area.missing_points : [],
    })),
    recentQuestions: (attempts ?? []).map((attempt: any) => attempt.question_id).filter(Boolean),
    userAnswerHistory: (attempts ?? []).map((attempt: any) => ({
      question_id: attempt.question_id ?? null,
      user_answer: attempt.user_answer,
      score: attempt.score,
    })),
    currentDate: new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()),
    timezone,
  };

  logger.info('tutor_context_loaded', {
    requestId: input.requestId ?? undefined,
    userId: input.userId,
    goalId: goal.id,
    chapterSlug: context.chapterSlug,
    sourceCount: context.sourceMaterialIds.length,
    weakAreaCount: context.recentWeakAreas.length,
  });

  return context;
}

function emptyTutorContext(userId: string, timezone: string): TutorContext {
  return {
    userId,
    activeGoalId: null,
    goalTitle: null,
    normalizedGoal: null,
    exam: null,
    subject: null,
    chapter: null,
    chapterSlug: null,
    currentMissionId: null,
    currentMicrotargetId: null,
    sourceMaterialIds: [],
    sourceStatuses: [],
    recentWeakAreas: [],
    recentQuestions: [],
    userAnswerHistory: [],
    currentDate: new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()),
    timezone,
  };
}

