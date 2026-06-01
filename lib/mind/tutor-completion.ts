import { EventDispatcher } from '@/lib/events/orchestrator';
import { logger } from '@/lib/utils/logger';

export const MIN_MIND_TUTOR_COVERAGE_TURNS = 8;

type IntentLike = {
  intent?: string;
  subject?: string;
  topic?: string;
  chapter?: string;
};

export type TutorSessionTopic = {
  subject: string;
  chapter: string;
  source: 'intent' | 'session_card' | 'weak_concept' | 'explicit';
};

export type PublishTutorProgressInput = {
  userId: string;
  sessionId?: string | null;
  message: string;
  fullResponse: string;
  history?: any[];
  sessionTurnsCount?: number;
  mindContext?: any;
  intent?: IntentLike | null;
  emotion?: string;
  sourceType?: string;
  assistantMessageId?: string | null;
  userMessageId?: string | null;
  conceptId?: string | null;
  subject?: string | null;
  chapter?: string | null;
};

export type TutorProgressPublishResult = {
  topic: TutorSessionTopic | null;
  conceptDiscoveryQueued: boolean;
  tutorCompletionQueued: boolean;
  reason?: 'no_topic' | 'coverage_incomplete' | 'not_learning_intent';
};

const LEARNING_INTENTS = new Set(['TUTOR_SESSION', 'PRACTICE']);

function cleanPart(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed || /^general$/i.test(trimmed)) return null;
  return trimmed;
}

function idempotencyPart(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'topic';
}

export function inferTutorSessionTopic(input: Pick<PublishTutorProgressInput, 'intent' | 'mindContext' | 'subject' | 'chapter'>): TutorSessionTopic | null {
  const explicitSubject = cleanPart(input.subject);
  const explicitChapter = cleanPart(input.chapter);
  if (explicitSubject && explicitChapter) {
    return { subject: explicitSubject, chapter: explicitChapter, source: 'explicit' };
  }

  const intentSubject = cleanPart(input.intent?.subject);
  const intentChapter = cleanPart(input.intent?.chapter) ?? cleanPart(input.intent?.topic);
  if (intentSubject && intentChapter) {
    return { subject: intentSubject, chapter: intentChapter, source: 'intent' };
  }

  const cardSubject = cleanPart(input.mindContext?.currentSessionCard?.subject);
  const cardChapter = cleanPart(input.mindContext?.currentSessionCard?.focusTopic);
  if (cardSubject && cardChapter) {
    return { subject: cardSubject, chapter: cardChapter, source: 'session_card' };
  }

  const weak = Array.isArray(input.mindContext?.weakConcepts)
    ? input.mindContext.weakConcepts[0]
    : null;
  const weakSubject = cleanPart(weak?.subject);
  const weakChapter = cleanPart(weak?.chapter) ?? cleanPart(weak?.name);
  if (weakSubject && weakChapter) {
    return { subject: weakSubject, chapter: weakChapter, source: 'weak_concept' };
  }

  return null;
}

function isLearningIntent(intent?: IntentLike | null): boolean {
  if (!intent?.intent) return true;
  return LEARNING_INTENTS.has(intent.intent);
}

export function hasMetTutorCoverage(input: Pick<PublishTutorProgressInput, 'sessionTurnsCount' | 'history'>): boolean {
  const explicitTurns = Number(input.sessionTurnsCount ?? 0);
  if (explicitTurns >= MIN_MIND_TUTOR_COVERAGE_TURNS) return true;

  const userTurnsFromHistory = Array.isArray(input.history)
    ? input.history.filter((turn: any) => turn?.role === 'user').length + 1
    : 1;
  return userTurnsFromHistory >= MIN_MIND_TUTOR_COVERAGE_TURNS;
}

export async function publishTutorProgressEvents(input: PublishTutorProgressInput): Promise<TutorProgressPublishResult> {
  const topic = inferTutorSessionTopic(input);
  if (!topic) return { topic: null, conceptDiscoveryQueued: false, tutorCompletionQueued: false, reason: 'no_topic' };

  let conceptDiscoveryQueued = false;
  try {
    await EventDispatcher.publish({
      user_id: input.userId,
      type: 'CONCEPT_DISCOVERED',
      data: {
        conceptId: input.conceptId ?? null,
        subject: topic.subject,
        chapter: topic.chapter,
        topic: topic.chapter,
        source_type: input.sourceType ?? 'mind_tutor',
      },
      metadata: { source: input.sourceType ?? 'mind_tutor' },
      idempotency_key: `concept_seed:mind:${input.userId}:${idempotencyPart(topic.subject)}:${idempotencyPart(topic.chapter)}`,
    });
    conceptDiscoveryQueued = true;
  } catch (err) {
    logger.warn('Tutor progress concept discovery publish failed', {
      userId: input.userId,
      subject: topic.subject,
      chapter: topic.chapter,
      err,
    });
  }

  if (!isLearningIntent(input.intent)) {
    return { topic, conceptDiscoveryQueued, tutorCompletionQueued: false, reason: 'not_learning_intent' };
  }

  if (!hasMetTutorCoverage(input)) {
    return { topic, conceptDiscoveryQueued, tutorCompletionQueued: false, reason: 'coverage_incomplete' };
  }

  const history = Array.isArray(input.history) ? input.history : [];
  const messageCount = Math.max(
    Number(input.sessionTurnsCount ?? 0),
    history.filter((turn: any) => turn?.role === 'user').length + 1
  );
  const estimatedMinutes = Math.max(8, Math.round(messageCount * 1.5));
  const completionKeyBase = input.sessionId
    ? input.sessionId
    : `${new Date().toISOString().slice(0, 13)}:00`;

  await EventDispatcher.publish({
    user_id: input.userId,
    type: 'MIND_TUTOR_COMPLETED',
    data: {
      conceptId: input.conceptId ?? null,
      subject: topic.subject,
      chapter: topic.chapter,
      durationMinutes: estimatedMinutes,
      messageCount,
      sessionType: input.sourceType ?? 'chat',
      history: history.slice(-8),
      latestMessage: input.message,
      latestResponse: input.fullResponse,
      isSessionComplete: true,
      coverageTurns: messageCount,
      minCoverageTurns: MIN_MIND_TUTOR_COVERAGE_TURNS,
      coverageStatus: 'covered',
      intent: input.intent?.intent ?? 'TUTOR_SESSION',
      emotion: input.emotion ?? 'neutral',
      user_message_id: input.userMessageId ?? undefined,
      assistant_message_id: input.assistantMessageId ?? undefined,
    },
    metadata: { source: input.sourceType ?? 'mind_tutor' },
    idempotency_key: `mind_tutor_completed:${input.userId}:${completionKeyBase}:${idempotencyPart(topic.subject)}:${idempotencyPart(topic.chapter)}`,
  });

  return { topic, conceptDiscoveryQueued, tutorCompletionQueued: true };
}
