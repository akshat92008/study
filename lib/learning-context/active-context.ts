import { normalizeGoal, type NormalizedGoal } from '@/lib/goals/normalize-goal';
import { resolveActiveGoalForUser } from '@/lib/goals/resolve-active-goal';
import { resolveCanonicalChapter } from '@/lib/goals/canonical-chapter';
import { logger } from '@/lib/utils/logger';

export type TutorMode = 'explain' | 'quiz' | 'repair' | 'autopsy' | 'revision' | 'practice' | 'discovery';

export type ActiveLearningContext = {
  // Identity
  userId: string;
  goalId: string | null;
  
  // Deterministic Taxonomy (No fuzzy fallbacks allowed)
  examId: string | null;
  subjectId: string | null;
  chapterId: string | null; // e.g. "Body Fluids and Circulation"
  chapterSlug: string | null; // e.g. "human-physiology-circulation"
  canonicalGoalSlug: string | null; // e.g. "neet-biology-human-physiology-circulation"
  topicId: string | null; // e.g. "blood-composition"
  
  // Context state
  mode: TutorMode;
  confidence: number;
  resolutionSource: 'explicit' | 'inferred' | 'fallback_rejected';
  
  // Source Grounding
  sourceIds: string[];
  sourceStatuses: Array<{ id: string; status: string; title: string | null }>;
  sourceChunkIds: string[];
  
  // Tracking
  recentWeakAreas: Array<{ concept_tag: string; severity: string; missing_points: string[] }>;
  recentQuestions: string[];
  userAnswerHistory: Array<{ question_id: string | null; user_answer: string; score: string }>;
  currentDate: string;
  timezone: string;
  
  // Raw DB Goal (for frontend hydration)
  rawGoal: any | null;
};

export async function loadActiveLearningContext(input: {
  supabase: any;
  userId: string;
  requestedGoalId?: string | null;
  requestedMode?: TutorMode;
  requestId?: string | null;
}): Promise<ActiveLearningContext> {
  const { data: profile } = await input.supabase
    .from('profiles')
    .select('timezone')
    .eq('id', input.userId)
    .maybeSingle();

  const timezone = profile?.timezone ?? 'UTC';

  try {
    // 1. Resolve Goal deterministically
    const resolution = await resolveActiveGoalForUser(input.supabase, input.userId, input.requestedGoalId);
    const goal = resolution.goal;
    const goalId = resolution.goalId;

    if (!goal || !goalId) {
      return emptyLearningContext(input.userId, timezone);
    }

    // 2. Fetch specific state directly bound to this exact goal
    const [{ data: mission }, { data: sources }, { data: weakAreas }, { data: attempts }] = await Promise.all([
      // Only get active seeded_topics, if not found, we don't hallucinate one
      input.supabase.from('seeded_topics')
        .select('id, topic, topic_slug, metadata')
        .eq('goal_id', goalId)
        .eq('user_id', input.userId)
        .in('status', ['active', 'in_progress'])
        .order('order_index', { ascending: true })
        .limit(1)
        .maybeSingle(),
      input.supabase.from('study_materials')
        .select('id, title, status')
        .eq('goal_id', goalId)
        .eq('user_id', input.userId)
        .order('updated_at', { ascending: false })
        .limit(20),
      input.supabase.from('weak_area_events')
        .select('concept_tag, severity, missing_points')
        .eq('goal_id', goalId)
        .eq('user_id', input.userId)
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(20),
      input.supabase.from('tutor_question_attempts')
        .select('question_id, user_answer, score')
        .eq('goal_id', goalId)
        .eq('user_id', input.userId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const metadataGoal = goal.metadata?.normalizedGoal as NormalizedGoal | undefined;
    const normalizedGoal = metadataGoal?.chapterSlug ? metadataGoal : normalizeGoal(goal.title ?? '');
    const canonicalChapter = resolveCanonicalChapter(
      normalizedGoal.chapterSlug ?? normalizedGoal.chapter ?? goal.title ?? mission?.topic_slug ?? ''
    );

    const context: ActiveLearningContext = {
      userId: input.userId,
      goalId: goal.id,
      
      examId: normalizedGoal.exam ?? goal.exam_type ?? null,
      subjectId: normalizedGoal.subject ?? goal.subject ?? null,
      chapterId: canonicalChapter?.title ?? normalizedGoal.chapter,
      chapterSlug: canonicalChapter?.chapterSlug ?? null,
      canonicalGoalSlug: canonicalChapter?.canonicalGoalSlug ?? normalizedGoal.chapterSlug ?? null,
      topicId: mission?.topic_slug ?? null,
      
      mode: input.requestedMode ?? (normalizedGoal.mode as TutorMode) ?? 'discovery',
      confidence: normalizedGoal.confidence ?? 1.0,
      resolutionSource: resolution.source === 'profile' ? 'explicit' : 'inferred',
      
      sourceIds: (sources ?? []).map((source: any) => source.id),
      sourceStatuses: (sources ?? []).map((source: any) => ({ id: source.id, status: source.status, title: source.title ?? null })),
      sourceChunkIds: [], // To be populated by retrieval pipelines later
      
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
      rawGoal: goal,
    };

    logger.info('active_context_loaded', {
      requestId: input.requestId ?? undefined,
      userId: input.userId,
      goalId: goal.id,
      chapterSlug: context.chapterSlug,
      topicId: context.topicId,
      sourceCount: context.sourceIds.length,
    });

    return context;
  } catch (error) {
    logger.error('failed_to_load_active_context', { userId: input.userId, error });
    return emptyLearningContext(input.userId, timezone);
  }
}

function emptyLearningContext(userId: string, timezone: string): ActiveLearningContext {
  return {
    userId,
    goalId: null,
    examId: null,
    subjectId: null,
    chapterId: null,
    chapterSlug: null,
    canonicalGoalSlug: null,
    topicId: null,
    mode: 'discovery',
    confidence: 0,
    resolutionSource: 'fallback_rejected',
    sourceIds: [],
    sourceStatuses: [],
    sourceChunkIds: [],
    recentWeakAreas: [],
    recentQuestions: [],
    userAnswerHistory: [],
    currentDate: new Intl.DateTimeFormat('en-CA', { timeZone: timezone }).format(new Date()),
    timezone,
    rawGoal: null,
  };
}
