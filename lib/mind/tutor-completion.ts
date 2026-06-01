import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';

export const MIN_MIND_TUTOR_COVERAGE_TURNS = 8;

type TutorTopicInput = {
  mindContext?: any;
  intent?: any;
  subject?: string | null;
  chapter?: string | null;
};

type TutorProgressInput = TutorTopicInput & {
  userId: string;
  sessionId: string;
  message: string;
  fullResponse: string;
  history?: any[];
  sessionTurnsCount?: number | null;
  sourceType?: string;
  conceptId?: string | null;
  assistantMessageId?: string | null;
  userMessageId?: string | null;
};

function cleanTopicPart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.toLowerCase() === 'general') return null;
  return trimmed;
}

function topicKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'topic';
}

export function inferTutorSessionTopic(input: TutorTopicInput): {
  subject: string | null;
  chapter: string | null;
} {
  const weakConcept = input.mindContext?.weakConcepts?.[0] ?? null;
  const currentTopic = input.mindContext?.currentTopic ?? null;
  const intent = input.intent ?? {};

  const subject =
    cleanTopicPart(input.subject) ||
    cleanTopicPart(intent.subject) ||
    cleanTopicPart(currentTopic?.subject) ||
    cleanTopicPart(weakConcept?.subject);

  const chapter =
    cleanTopicPart(input.chapter) ||
    cleanTopicPart(intent.chapter) ||
    cleanTopicPart(intent.topic) ||
    cleanTopicPart(currentTopic?.chapter) ||
    cleanTopicPart(currentTopic?.topic) ||
    cleanTopicPart(weakConcept?.chapter) ||
    cleanTopicPart(weakConcept?.name);

  return { subject, chapter };
}

export function getTutorCoverageTurns(input: {
  history?: any[];
  sessionTurnsCount?: number | null;
}): number {
  const suppliedTurns = Number(input.sessionTurnsCount ?? 0);
  const userTurnsFromHistory = Array.isArray(input.history)
    ? input.history.filter((item) => item?.role === 'user').length
    : 0;
  return Math.max(
    Number.isFinite(suppliedTurns) ? suppliedTurns : 0,
    userTurnsFromHistory
  );
}

export function hasMetTutorCoverage(input: {
  history?: any[];
  sessionTurnsCount?: number | null;
}): boolean {
  return getTutorCoverageTurns(input) >= MIN_MIND_TUTOR_COVERAGE_TURNS;
}

export async function publishTutorProgressEvents(input: TutorProgressInput): Promise<{
  conceptDiscovered: boolean;
  tutorCompleted: boolean;
  coverageTurns: number;
  subject: string | null;
  chapter: string | null;
}> {
  const { subject, chapter } = inferTutorSessionTopic(input);
  const coverageTurns = getTutorCoverageTurns(input);

  if (!subject || !chapter) {
    logger.info('Tutor progress skipped: no concrete subject/chapter', {
      userId: input.userId,
      sessionId: input.sessionId,
      coverageTurns,
    });
    return { conceptDiscovered: false, tutorCompleted: false, coverageTurns, subject, chapter };
  }

  const source = input.sourceType || 'mind_tutor';
  const topicSuffix = `${topicKey(subject)}:${topicKey(chapter)}`;

  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'CONCEPT_DISCOVERED',
    data: {
      conceptId: input.conceptId ?? null,
      subject,
      chapter,
      topic: chapter,
      sourceSessionId: input.sessionId,
      coverageTurns,
      minCoverageTurns: MIN_MIND_TUTOR_COVERAGE_TURNS,
    },
    metadata: { source },
    idempotency_key: `concept_discovered:tutor:${input.userId}:${topicSuffix}`,
  });

  if (coverageTurns < MIN_MIND_TUTOR_COVERAGE_TURNS) {
    return { conceptDiscovered: true, tutorCompleted: false, coverageTurns, subject, chapter };
  }

  const history = Array.isArray(input.history) ? input.history : [];
  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'MIND_TUTOR_COMPLETED',
    data: {
      sessionId: input.sessionId,
      conceptId: input.conceptId ?? null,
      subject,
      chapter,
      durationMinutes: Math.max(8, Math.round(Math.max(history.length, coverageTurns * 2) * 1.5)),
      messageCount: history.length,
      sessionType: 'mind_tutor',
      history: history.slice(-8),
      latestMessage: input.message,
      latestResponse: input.fullResponse,
      assistantMessageId: input.assistantMessageId ?? null,
      userMessageId: input.userMessageId ?? null,
      coverageTurns,
      minCoverageTurns: MIN_MIND_TUTOR_COVERAGE_TURNS,
      isSessionComplete: true,
      intent: input.intent?.intent ?? 'TUTOR_SESSION',
    },
    metadata: { source },
    idempotency_key: `mind_tutor_completed:${input.userId}:${input.sessionId}:${topicSuffix}`,
  });

  return { conceptDiscovered: true, tutorCompleted: true, coverageTurns, subject, chapter };
}
