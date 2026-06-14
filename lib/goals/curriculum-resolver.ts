import { getOrCreatePrimaryGoalSession, GOAL_SELECT, SESSION_SELECT } from '@/lib/services/goal-context.service';
import { seedTopicsForGoal } from '@/lib/topic-seeding';
import { getOrCreateGoalMission } from '@/lib/hermes/ui/mission-service';
import { inferGoalDomain, type GoalDomain } from './goal-domain';
import { normalizeGoal, type NormalizedGoal } from './normalize-goal';
import { logger } from '@/lib/utils/logger';

type OptionalGoalDetails = {
  subject?: string | null;
  domain?: string | null;
  examType?: string | null;
  presetId?: string | null;
  targetLevel?: string | null;
  description?: string | null;
  deadline?: string | null;
  currentLevel?: string | null;
  timeAvailable?: unknown;
  preferredLearningStyle?: string | null;
  goalType?: string | null;
  targetDate?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type CreateResolvedLearningGoalResult =
  | {
      success: true;
      goal: any;
      session: any;
      goalId: string;
      sessionId: string;
      domain: GoalDomain;
      topicSeeding: any;
      mission: any;
      normalizedGoal: NormalizedGoal;
    }
  | {
      success: false;
      needsClarification: true;
      domain: GoalDomain;
      clarificationQuestion: string;
      suggestions: string[];
    };

function optionalString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function explicitDomainProvided(details: OptionalGoalDetails): boolean {
  return Boolean(
    optionalString(details.subject)
    || optionalString(details.domain)
    || optionalString(details.examType)
    || optionalString(details.goalType)
    || optionalString(details.targetLevel)
  );
}

export async function createResolvedLearningGoal(input: {
  supabase: any;
  userId: string;
  title: string;
  details?: OptionalGoalDetails;
}): Promise<CreateResolvedLearningGoalResult> {
  const details = input.details ?? {};
  const normalizedGoal = normalizeGoal(input.title);
  const domain = inferGoalDomain(input.title, {
    subject: details.subject ?? null,
    domain: details.domain ?? details.goalType ?? null,
    exam: details.examType ?? null,
    grade: details.targetLevel ?? null,
  });

  logger.info('goal_normalized', {
    userId: input.userId,
    rawTitle: input.title,
    normalizedTitle: normalizedGoal.normalizedTitle,
    chapterSlug: normalizedGoal.chapterSlug,
    confidence: normalizedGoal.confidence,
  });

  if (domain.needsClarification && !explicitDomainProvided(details)) {
    return {
      success: false,
      needsClarification: true,
      domain,
      clarificationQuestion: domain.clarificationQuestion ?? 'What should this goal focus on?',
      suggestions: [
        'Class 10 History',
        'Master Physics Class 12',
        'Prepare for NEET Biology',
      ],
    };
  }

  const metadata = {
    ...(details.metadata ?? {}),
    currentLevel: optionalString(details.currentLevel),
    timeAvailable: details.timeAvailable ?? null,
    preferredLearningStyle: optionalString(details.preferredLearningStyle),
    domain,
    normalizedGoal,
  };

  const { data: goal, error: goalError } = await input.supabase
    .from('learning_goals')
    .insert({
      user_id: input.userId,
      title: normalizedGoal.chapter ? normalizedGoal.normalizedTitle : input.title,
      subject: optionalString(details.subject) ?? normalizedGoal.subject ?? domain.subject,
      domain: optionalString(details.domain) ?? domain.domain,
      exam_type: optionalString(details.examType) ?? normalizedGoal.exam ?? domain.exam,
      preset_id: optionalString(details.presetId),
      target_level: optionalString(details.targetLevel) ?? normalizedGoal.classLevel ?? domain.grade,
      description: optionalString(details.description),
      target_date: optionalString(details.deadline) ?? optionalString(details.targetDate),
      progress: 0,
      status: 'active',
      last_active_at: new Date().toISOString(),
      metadata,
    })
    .select(GOAL_SELECT)
    .single();

  if (goalError || !goal) throw goalError ?? new Error('Goal insert failed');

  const session = await getOrCreatePrimaryGoalSession(input.supabase, input.userId, goal.id);

  let topicSeeding: any = null;
  try {
    topicSeeding = await seedTopicsForGoal(input.supabase, {
      userId: input.userId,
      goalId: goal.id,
      goalTitle: goal.title ?? input.title,
      goalType: details.goalType ?? details.examType ?? domain.exam ?? domain.domain,
      presetId: goal.preset_id ?? details.presetId ?? null,
      subject: domain.subject ?? details.subject ?? null,
      subjects: domain.subject ? [domain.subject] : details.subject ? [details.subject] : [],
      domain: domain.domain,
      exam: domain.exam,
      grade: domain.grade,
      board: domain.board,
      chapter: normalizedGoal.chapter,
      targetDate: details.targetDate ?? details.deadline ?? null,
    });
  } catch (error) {
    topicSeeding = {
      seeded: 0,
      skipped: true,
      templateKey: 'none',
      source: 'custom_seed',
      reason: error instanceof Error ? error.message : 'topic seeding failed',
    };
  }

  const mission = await getOrCreateGoalMission(input.supabase, input.userId, goal.id, new Date().toISOString().split('T')[0])
    .catch((error: any) => ({
      tasks: [],
      created: false,
      reason: error?.message ?? 'mission self-heal skipped',
    }));

  const { data: hydratedGoal } = await input.supabase
    .from('learning_goals')
    .select(GOAL_SELECT)
    .eq('id', goal.id)
    .eq('user_id', input.userId)
    .single();

  const { data: hydratedSession } = await input.supabase
    .from('chat_sessions')
    .select(SESSION_SELECT)
    .eq('id', session.id)
    .eq('user_id', input.userId)
    .single();

  return {
    success: true,
    goal: hydratedGoal ?? goal,
    session: hydratedSession ?? session,
    goalId: goal.id,
    sessionId: session.id,
    domain,
    topicSeeding,
    mission,
    normalizedGoal,
  };
}
