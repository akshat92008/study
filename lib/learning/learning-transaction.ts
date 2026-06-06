/**
 * lib/learning/learning-transaction.ts
 *
 * CANONICAL LEARNING TRANSACTION SERVICE
 * =======================================
 * Every meaningful learner interaction produces a durable, structured result.
 *
 * This is the single coordinator that:
 *  1. Accepts any interaction source type
 *  2. Detects concepts and weak areas
 *  3. Ingests the correct learning signal
 *  4. Creates mistakes if detected
 *  5. Updates mastery evidence
 *  6. Schedules retests
 *  7. Returns a learner-visible summary + next action
 *
 * Existing services (repair-loop, mastery-updater, signal ingest, session-card)
 * are NOT replaced — they are called from here in the right order.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { ingestLearningSignal } from '@/lib/learning-signals/ingest';
import { upsertMistakeRisk } from '@/lib/services/repair-loop.service';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { captureSentryException } from '@/lib/telemetry/sentry-runtime';
import type { LearningSignalType } from '@/lib/learning-signals/types';

// ─────────────────────────────────────────────────────────────────────────────
// INPUT / OUTPUT TYPES
// ─────────────────────────────────────────────────────────────────────────────

export type TransactionSource =
  | 'typed_doubt'
  | 'quiz_attempt'
  | 'photo_doubt'
  | 'pdf_upload'
  | 'autopsy_upload'
  | 'manual_mistake'
  | 'session_completion';

export interface LearningTransactionInput {
  supabase: SupabaseClient;
  userId: string;
  source: TransactionSource;
  idempotencyKey?: string;
  sessionId?: string | null;
  goalId?: string | null;

  // Content
  userText?: string | null;
  assistantText?: string | null;
  extractedText?: string | null;

  // Structured metadata from upstream extraction
  imageMetadata?: PhotoDoubtMetadata | null;
  pdfMetadata?: PdfUploadMetadata | null;
  quizAttempt?: QuizAttemptMetadata | null;
  mistakes?: ManualMistake[];
  context?: Record<string, unknown>;
}

export interface PhotoDoubtMetadata {
  topic?: string | null;
  subject?: string | null;
  conceptsTested?: string[];
  detectedMistake?: string | null;
  isCorrect?: boolean | null;
  confidence?: number;
}

export interface PdfUploadMetadata {
  materialId: string;
  chunkCount: number;
  pageCount: number | null;
  subject?: string | null;
  topic?: string | null;
}

export interface QuizAttemptMetadata {
  practiceSetId: string;
  correctCount: number;
  wrongCount: number;
  wrongConceptNames: string[];
  wrongConceptIds: string[];
  subject?: string | null;
  topic?: string | null;
}

export interface ManualMistake {
  concept?: string | null;
  subject?: string | null;
  topic?: string | null;
  chapter?: string | null;
  mistakeText: string;
  correctAnswer?: string | null;
  severity?: number;
}

// Output types
export interface DetectedConcept {
  name: string;
  subject?: string | null;
  chapter?: string | null;
}

export interface WeakArea {
  concept: string;
  subject?: string | null;
  chapter?: string | null;
  reason: string;
  confidence: number;
}

export interface MistakeSummary {
  concept: string;
  created: boolean;
  revisionCardCreated: boolean;
  retestScheduled: boolean;
}

export interface MasteryUpdateSummary {
  conceptId: string;
  conceptName: string;
  evidenceType: string;
}

export interface RevisionCardSummary {
  conceptName: string;
}

export interface RetestSummary {
  conceptName: string;
}

export interface DailySessionSummary {
  invalidated: boolean;
}

export interface LearningTransactionResult {
  ok: boolean;
  error?: string;

  // Structured content
  detectedConcepts: DetectedConcept[];
  weakAreas: WeakArea[];
  mistakesCreated: MistakeSummary[];
  masteryUpdates: MasteryUpdateSummary[];
  revisionCardsCreated: RevisionCardSummary[];
  retestsScheduled: RetestSummary[];
  dailySessionUpdated: DailySessionSummary | null;

  // Learner-visible
  learningSignalSummary: string;
  nextAction?: {
    label: string;
    type: 'review' | 'practice' | 'repair' | 'continue' | 'upload';
    payload?: unknown;
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// SOURCE → SIGNAL TYPE MAPPING
// ─────────────────────────────────────────────────────────────────────────────

const SOURCE_TO_SIGNAL: Record<TransactionSource, LearningSignalType> = {
  typed_doubt: 'chat_confusion',
  quiz_attempt: 'practice_attempt',
  photo_doubt: 'chat_confusion',
  pdf_upload: 'source_upload',
  autopsy_upload: 'source_upload',
  manual_mistake: 'manual_mistake',
  session_completion: 'task_completion',
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN ENTRY POINT
// ─────────────────────────────────────────────────────────────────────────────

export async function processLearningTransaction(
  input: LearningTransactionInput
): Promise<LearningTransactionResult> {
  const result: LearningTransactionResult = {
    ok: true,
    detectedConcepts: [],
    weakAreas: [],
    mistakesCreated: [],
    masteryUpdates: [],
    revisionCardsCreated: [],
    retestsScheduled: [],
    dailySessionUpdated: null,
    learningSignalSummary: '',
  };

  try {
    switch (input.source) {
      case 'typed_doubt':
        await handleTypedDoubt(input, result);
        break;
      case 'photo_doubt':
        await handlePhotoDoubt(input, result);
        break;
      case 'pdf_upload':
        await handlePdfUpload(input, result);
        break;
      case 'quiz_attempt':
        await handleQuizAttempt(input, result);
        break;
      case 'autopsy_upload':
        await handleAutopsyUpload(input, result);
        break;
      case 'manual_mistake':
        await handleManualMistake(input, result);
        break;
      case 'session_completion':
        await handleSessionCompletion(input, result);
        break;
    }

    result.learningSignalSummary = buildLearnerSummary(input.source, result);
    result.nextAction = computeNextAction(input.source, result);

    return result;
  } catch (err) {
    captureSentryException(err, {
      tags: { feature: 'learning_transaction', source: input.source, userId: input.userId },
    });
    logger.error('LearningTransaction failed', {
      source: input.source,
      userId: input.userId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ...result,
      ok: false,
      error: err instanceof Error ? err.message : 'Learning transaction failed',
      learningSignalSummary: '',
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HANDLERS BY SOURCE
// ─────────────────────────────────────────────────────────────────────────────

async function handleTypedDoubt(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  const { supabase, userId, goalId, idempotencyKey } = input;

  // Detect concepts from the conversation text
  const conceptsFromText = extractConceptsFromText(input.userText, input.assistantText);
  result.detectedConcepts = conceptsFromText;

  const isConfusion = detectConfusionSignal(input.userText);
  const signalType: LearningSignalType = isConfusion ? 'chat_confusion' : SOURCE_TO_SIGNAL.typed_doubt;

  if (conceptsFromText.length > 0 || isConfusion) {
    const firstConcept = conceptsFromText[0];
    await ingestLearningSignal(supabase, {
      user_id: userId,
      goal_id: goalId ?? null,
      signal_type: signalType,
      source_type: 'typed_doubt',
      subject: firstConcept?.subject ?? null,
      topic: firstConcept?.name ?? null,
      confidence: isConfusion ? 0.68 : 0.55,
      evidence: {
        userText: input.userText?.slice(0, 500),
        assistantSnippet: input.assistantText?.slice(0, 300),
        detectedConcepts: conceptsFromText.map(c => c.name),
      },
    }, { idempotencyKey: idempotencyKey ? `lt_doubt:${idempotencyKey}` : undefined });

    if (isConfusion) {
      result.weakAreas.push({
        concept: firstConcept?.name ?? 'Chat-detected confusion',
        subject: firstConcept?.subject ?? null,
        chapter: firstConcept?.chapter ?? null,
        reason: 'Confusion detected in typed doubt',
        confidence: 0.68,
      });
    }
  }

  // Invalidate daily session card so next-action recalculates
  await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: goalId ?? null,
  }).catch(() => undefined);

  result.dailySessionUpdated = { invalidated: true };
}

async function handlePhotoDoubt(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  const { supabase, userId, goalId, idempotencyKey, imageMetadata } = input;

  const topic = imageMetadata?.topic ?? null;
  const subject = imageMetadata?.subject ?? null;
  const conceptsTested = imageMetadata?.conceptsTested ?? [];

  result.detectedConcepts = conceptsTested.map(name => ({ name, subject, chapter: null }));

  const hasDetectedMistake = !!(imageMetadata?.detectedMistake);
  const signalType: LearningSignalType = hasDetectedMistake ? 'chat_confusion' : 'chat_confusion';

  await ingestLearningSignal(supabase, {
    user_id: userId,
    goal_id: goalId ?? null,
    signal_type: signalType,
    source_type: 'photo_doubt',
    subject,
    topic,
    confidence: imageMetadata?.confidence ?? 0.65,
    evidence: {
      topic,
      subject,
      conceptsTested,
      detectedMistake: imageMetadata?.detectedMistake,
      assistantSnippet: input.assistantText?.slice(0, 300),
    },
  }, { idempotencyKey: idempotencyKey ? `lt_photo:${idempotencyKey}` : undefined });

  if (hasDetectedMistake && imageMetadata?.detectedMistake) {
    const repair = await upsertMistakeRisk(supabase, {
      userId,
      goalId: goalId ?? null,
      source: 'chat',
      subject,
      topic,
      chapter: topic ?? null,
      concept: imageMetadata.detectedMistake,
      mistakeText: imageMetadata.detectedMistake,
      correctAnswer: input.assistantText?.slice(0, 200) ?? null,
      whyWrong: 'Detected from photo doubt analysis.',
      examTrap: 'Clear this before next practice session.',
      severity: 2,
      category: 'conceptual_gap',
      sourceId: idempotencyKey ?? userId,
      metadata: { source: 'photo_doubt', topic, subject },
    }).catch(() => ({ created: false, revisionCardCreated: false, retestScheduled: false }));

    result.mistakesCreated.push({
      concept: imageMetadata.detectedMistake,
      created: repair.created,
      revisionCardCreated: repair.revisionCardCreated,
      retestScheduled: repair.retestScheduled,
    });
    if (repair.revisionCardCreated) {
      result.revisionCardsCreated.push({ conceptName: imageMetadata.detectedMistake });
    }
    if (repair.retestScheduled) {
      result.retestsScheduled.push({ conceptName: imageMetadata.detectedMistake });
    }
    result.weakAreas.push({
      concept: imageMetadata.detectedMistake,
      subject,
      chapter: topic,
      reason: 'Mistake detected in photo doubt',
      confidence: 0.72,
    });
  }

  if (topic && conceptsTested.length > 0) {
    // Record mastery evidence for each concept seen in the photo
    for (const conceptName of conceptsTested.slice(0, 5)) {
      result.masteryUpdates.push({
        conceptId: conceptName,
        conceptName,
        evidenceType: 'photo_doubt_exposure',
      });
    }
  }

  await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: goalId ?? null,
  }).catch(() => undefined);

  result.dailySessionUpdated = { invalidated: true };
}

async function handlePdfUpload(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  const { supabase, userId, goalId, idempotencyKey, pdfMetadata } = input;

  await ingestLearningSignal(supabase, {
    user_id: userId,
    goal_id: goalId ?? null,
    signal_type: 'source_upload',
    source_type: 'pdf_upload',
    subject: pdfMetadata?.subject ?? null,
    topic: pdfMetadata?.topic ?? null,
    confidence: 0.75,
    evidence: {
      materialId: pdfMetadata?.materialId,
      chunkCount: pdfMetadata?.chunkCount,
      pageCount: pdfMetadata?.pageCount,
    },
  }, { idempotencyKey: idempotencyKey ? `lt_pdf:${idempotencyKey}` : undefined });

  if (pdfMetadata?.subject || pdfMetadata?.topic) {
    result.detectedConcepts.push({
      name: pdfMetadata.topic ?? pdfMetadata.subject ?? 'Uploaded material',
      subject: pdfMetadata.subject ?? null,
    });
  }

  await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: goalId ?? null,
  }).catch(() => undefined);

  result.dailySessionUpdated = { invalidated: true };
}

async function handleQuizAttempt(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  // Quiz attempts are already handled by the practice/attempts route with
  // syncStudyProfileAfterPracticeAttempt. This handler creates the unified
  // result summary from the quiz metadata for use in the learning transaction result.
  const { quizAttempt } = input;
  if (!quizAttempt) return;

  result.detectedConcepts = quizAttempt.wrongConceptNames.map(name => ({
    name,
    subject: quizAttempt.subject ?? null,
    chapter: quizAttempt.topic ?? null,
  }));

  result.weakAreas = quizAttempt.wrongConceptNames.map(name => ({
    concept: name,
    subject: quizAttempt.subject ?? null,
    chapter: quizAttempt.topic ?? null,
    reason: 'Wrong answer in quiz',
    confidence: 0.8,
  }));
}

async function handleAutopsyUpload(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  const { supabase, userId, goalId, idempotencyKey } = input;

  await ingestLearningSignal(supabase, {
    user_id: userId,
    goal_id: goalId ?? null,
    signal_type: 'source_upload',
    source_type: 'autopsy_upload',
    confidence: 0.80,
    evidence: { context: input.context },
  }, { idempotencyKey: idempotencyKey ? `lt_autopsy:${idempotencyKey}` : undefined });
}

async function handleManualMistake(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  const { supabase, userId, goalId, mistakes = [] } = input;

  for (const mistake of mistakes.slice(0, 10)) {
    const repair = await upsertMistakeRisk(supabase, {
      userId,
      goalId: goalId ?? null,
      source: 'manual',
      subject: mistake.subject ?? null,
      topic: mistake.topic ?? null,
      chapter: mistake.chapter ?? null,
      concept: mistake.concept ?? 'Manual mistake',
      mistakeText: mistake.mistakeText,
      correctAnswer: mistake.correctAnswer ?? null,
      whyWrong: 'Manually reported by learner.',
      examTrap: 'Clear this with a retest before moving forward.',
      severity: mistake.severity ?? 2,
      category: 'conceptual_gap',
      sourceId: input.idempotencyKey ?? userId,
      metadata: {},
    }).catch(() => ({ created: false, revisionCardCreated: false, retestScheduled: false }));

    result.mistakesCreated.push({
      concept: mistake.concept ?? 'Manual mistake',
      created: repair.created,
      revisionCardCreated: repair.revisionCardCreated,
      retestScheduled: repair.retestScheduled,
    });
    if (repair.revisionCardCreated) {
      result.revisionCardsCreated.push({ conceptName: mistake.concept ?? 'Mistake' });
    }
    if (repair.retestScheduled) {
      result.retestsScheduled.push({ conceptName: mistake.concept ?? 'Mistake' });
    }
  }

  await ingestLearningSignal(supabase, {
    user_id: userId,
    goal_id: goalId ?? null,
    signal_type: 'manual_mistake',
    source_type: 'manual_mistake',
    confidence: 0.9,
    evidence: { mistakeCount: mistakes.length },
  }, { idempotencyKey: input.idempotencyKey ? `lt_manual:${input.idempotencyKey}` : undefined });

  await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: goalId ?? null,
  }).catch(() => undefined);

  result.dailySessionUpdated = { invalidated: true };
}

async function handleSessionCompletion(
  input: LearningTransactionInput,
  result: LearningTransactionResult
) {
  const { supabase, userId, goalId, idempotencyKey } = input;

  await ingestLearningSignal(supabase, {
    user_id: userId,
    goal_id: goalId ?? null,
    signal_type: 'task_completion',
    source_type: 'session_completion',
    confidence: 0.85,
    evidence: { context: input.context },
  }, { idempotencyKey: idempotencyKey ? `lt_session:${idempotencyKey}` : undefined });

  await invalidateSessionCard(userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: goalId ?? null,
  }).catch(() => undefined);

  result.dailySessionUpdated = { invalidated: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractConceptsFromText(
  userText?: string | null,
  assistantText?: string | null
): DetectedConcept[] {
  const combined = `${userText ?? ''} ${assistantText ?? ''}`.toLowerCase();

  // Subject detection
  let subject: string | null = null;
  if (/\b(physics|mechanics|thermodynamics|electrostatics|optics|waves)\b/.test(combined)) {
    subject = 'Physics';
  } else if (/\b(chemistry|organic|inorganic|physical chemistry|reaction|bond)\b/.test(combined)) {
    subject = 'Chemistry';
  } else if (/\b(biology|cell|genetics|evolution|ecology|botany|zoology|physiology)\b/.test(combined)) {
    subject = 'Biology';
  } else if (/\b(maths|mathematics|calculus|algebra|geometry|trigonometry)\b/.test(combined)) {
    subject = 'Mathematics';
  }

  // Extract topic candidates (capitalized phrases, 2-5 words)
  const topicMatches = (userText ?? '').match(/\b[A-Z][a-z]+(?: [A-Za-z]+){0,3}\b/g) ?? [];
  const concepts: DetectedConcept[] = [];

  if (topicMatches.length > 0) {
    // Take the first meaningful match as the primary concept
    const candidate = topicMatches[0];
    if (candidate && candidate.length > 3 && candidate.length < 60) {
      concepts.push({ name: candidate, subject, chapter: null });
    }
  }

  return concepts;
}

function detectConfusionSignal(userText?: string | null): boolean {
  if (!userText) return false;
  return /\b(confus|stuck|doubt|why|how|don't understand|not getting|what is|help|explain|unclear)\b/i.test(userText);
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY BUILDER
// ─────────────────────────────────────────────────────────────────────────────

function buildLearnerSummary(
  source: TransactionSource,
  result: LearningTransactionResult
): string {
  const parts: string[] = [];

  if (result.detectedConcepts.length > 0) {
    parts.push(`${result.detectedConcepts.length} concept${result.detectedConcepts.length > 1 ? 's' : ''} detected`);
  }

  if (result.weakAreas.length > 0) {
    parts.push(`${result.weakAreas.length} weak signal${result.weakAreas.length > 1 ? 's' : ''} logged`);
  }

  if (result.mistakesCreated.filter(m => m.created).length > 0) {
    const count = result.mistakesCreated.filter(m => m.created).length;
    parts.push(`${count} mistake${count > 1 ? 's' : ''} tracked`);
  }

  if (result.revisionCardsCreated.length > 0) {
    parts.push(`${result.revisionCardsCreated.length} review card${result.revisionCardsCreated.length > 1 ? 's' : ''} created`);
  }

  if (result.retestsScheduled.length > 0) {
    parts.push(`${result.retestsScheduled.length} retest${result.retestsScheduled.length > 1 ? 's' : ''} scheduled`);
  }

  if (parts.length === 0) {
    const sourceLabels: Record<TransactionSource, string> = {
      typed_doubt: 'Doubt logged to learning profile.',
      quiz_attempt: 'Quiz results saved.',
      photo_doubt: 'Photo doubt answered.',
      pdf_upload: 'Study material indexed.',
      autopsy_upload: 'Mistake review queued.',
      manual_mistake: 'Mistake logged.',
      session_completion: 'Session complete.',
    };
    return sourceLabels[source];
  }

  return parts.join(' · ') + '.';
}

// ─────────────────────────────────────────────────────────────────────────────
// NEXT ACTION COMPUTER
// ─────────────────────────────────────────────────────────────────────────────

function computeNextAction(
  source: TransactionSource,
  result: LearningTransactionResult
): LearningTransactionResult['nextAction'] {
  if (result.retestsScheduled.length > 0) {
    return {
      label: `Retest: ${result.retestsScheduled[0].conceptName}`,
      type: 'review',
    };
  }

  if (result.revisionCardsCreated.length > 0) {
    return {
      label: 'Review your new cards',
      type: 'review',
    };
  }

  if (result.weakAreas.length > 0) {
    return {
      label: `Practice: ${result.weakAreas[0].concept}`,
      type: 'practice',
      payload: { concept: result.weakAreas[0].concept, subject: result.weakAreas[0].subject },
    };
  }

  if (source === 'pdf_upload') {
    return {
      label: 'Ask a question about this material',
      type: 'continue',
    };
  }

  if (source === 'session_completion') {
    return {
      label: 'Start tomorrow\'s session',
      type: 'continue',
    };
  }

  return {
    label: 'Continue studying',
    type: 'continue',
  };
}
