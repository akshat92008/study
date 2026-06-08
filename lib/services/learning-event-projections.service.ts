import { createAdminClient } from '@/lib/supabase/admin';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { recordAgentAction } from '@/lib/agents/agent-runtime';
import {
  recordMasteryEvidence,
  type MasteryEvidenceType,
  type MasterySource,
} from '@/lib/engines/mastery-updater';
import {
  notifyWeakConceptPlanChange,
  type WeakConceptPlanChange,
} from '@/lib/services/learning-plan-updates.service';
import { syncStudyProfileAfterPracticeAttempt } from '@/lib/services/study-profile-sync.service';
import { createRevisionCardsForUser } from '@/lib/amaura/agents/repositories';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { logger } from '@/lib/utils/logger';

type SupabaseLike = ReturnType<typeof createAdminClient> | any;

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function numberOr(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function learningSignalEvidence(signalType: string): {
  evidenceType: MasteryEvidenceType;
  source: MasterySource;
  weak: boolean;
  weight?: number;
} | null {
  switch (signalType) {
    case 'practice_attempt':
    case 'question_mistake':
    case 'manual_mistake':
      return { evidenceType: 'practice_wrong', source: 'practice', weak: true };
    case 'chat_confusion':
    case 'confusion_detected':
      return { evidenceType: 'tutor_confused', source: 'tutor_session', weak: true };
    case 'doubt_asked':
      return { evidenceType: 'tutor_confused', source: 'tutor_session', weak: true, weight: -2 };
    case 'practice_requested':
    case 'concept_practiced':
      return { evidenceType: 'tutor_session', source: 'tutor_session', weak: false, weight: 1 };
    case 'revision_review':
      return { evidenceType: 'revision_again', source: 'card_review', weak: true };
    case 'source_upload':
      return { evidenceType: 'session_completed', source: 'command', weak: false, weight: 3 };
    case 'task_completion':
      return { evidenceType: 'remediation_completed', source: 'command', weak: false };
    case 'self_reflection':
      return { evidenceType: 'tutor_understood', source: 'tutor_session', weak: true, weight: 1 };
    default:
      return null;
  }
}

import { projectLearningSignal } from '@/lib/learner-state/projector';
import type { LearningSignal } from '@/lib/agent/types';

export async function projectLearningSignalToStudyState(input: {
  userId: string;
  payload: Record<string, any>;
  eventId?: string | null;
  client?: SupabaseLike;
}) {
  const supabase = input.client ?? createAdminClient();
  const signalType = asString(input.payload.signalType ?? input.payload.signal_type) ?? 'unknown';
  const topic = asString(input.payload.topic ?? input.payload.conceptName ?? input.payload.chapter);
  const sourceId = asString(input.payload.sourceId ?? input.payload.source_id) ?? input.eventId ?? `${signalType}:${Date.now()}`;
  const goalId = asString(input.payload.goalId ?? input.payload.goal_id);
  const confidence = numberOr(input.payload.confidence, 0.75);

  if (!topic) {
    return { conceptsUpdated: 0, cardsCreated: 0, tasksCreated: 0, reason: 'missing_topic' };
  }

  // Map legacy payload to new LearningSignal
  const signal: LearningSignal = {
    type: signalType as any,
    concept: topic,
    canonicalConcept: topic,
    subject: asString(input.payload.subject) || 'General',
    chapter: topic,
    topic,
    confidence,
    source: (input.payload.source as any) || 'background',
    evidence: input.payload.evidence || `${signalType} signal for ${topic}`,
    metadata: {
      ...input.payload,
      idempotencyKey: input.eventId || undefined,
      sourceId,
      goalId,
    },
  };

  const result = await projectLearningSignal(supabase, input.userId, signal, { goalId });

  return {
    conceptsUpdated: result.masteryUpdated ? 1 : 0,
    cardsCreated: result.cardsCreated,
    tasksCreated: result.mistakeRecorded ? 1 : 0,
    notificationSent: result.cardsCreated > 0,
    reason: 'projected_via_central_projector',
  };
}


export async function projectMaterialIngestedToStudyState(input: {
  userId: string;
  payload: Record<string, any>;
  eventId?: string | null;
  client?: SupabaseLike;
}) {
  const supabase = input.client ?? createAdminClient();
  const materialId = asString(input.payload.materialId ?? input.payload.material_id);
  if (!materialId) return { conceptsUpdated: 0, cardsCreated: 0, reason: 'missing_material_id' };

  const { data: material, error: materialError } = await supabase
    .from('study_materials')
    .select('id, title, subject, chapter, topic, goal_id, chat_session_id, page_count, char_count')
    .eq('id', materialId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (materialError) throw materialError;
  if (!material) return { conceptsUpdated: 0, cardsCreated: 0, reason: 'material_not_found' };

  const { data: chunks } = await supabase
    .from('study_material_chunks')
    .select('id, content, heading, page_start')
    .eq('material_id', materialId)
    .eq('user_id', input.userId)
    .order('chunk_index', { ascending: true })
    .limit(2);

  const topic = asString(material.topic ?? material.chapter ?? material.title) ?? 'Uploaded source';
  const subject = asString(material.subject) ?? 'General';
  const resolution = await resolveConcept({
    userId: input.userId,
    subject,
    chapter: asString(material.chapter) ?? topic,
    topic,
    sourceType: 'ingest',
    confidence: 0.95,
    client: supabase,
  });

  let conceptsUpdated = 0;
  if (resolution.conceptId) {
    const result = await recordMasteryEvidence({
      userId: input.userId,
      conceptId: resolution.conceptId,
      evidenceType: 'session_completed',
      source: 'command',
      sourceId: materialId,
      sourceEventId: input.eventId ?? undefined,
      evidence: `Material ingested: ${material.title}`,
      weight: 3,
      confidence: 0.7,
      client: supabase,
    });
    conceptsUpdated = result.changed ? 1 : 0;
  }

  const firstText = asString(chunks?.[0]?.content)?.slice(0, 700);
  const cards = firstText
    ? await createRevisionCardsForUser(
        input.userId,
        [{
          goalId: material.goal_id ?? null,
          chatSessionId: material.chat_session_id ?? null,
          conceptId: resolution.conceptId,
          subject,
          chapter: asString(material.chapter) ?? topic,
          front: `What are the main ideas from ${material.title}?`,
          back: firstText,
          dueAt: new Date().toISOString(),
          sourceType: 'material_ingested',
          sourceId: materialId,
          metadata: {
            sourceEventId: input.eventId ?? null,
            chunkId: chunks?.[0]?.id ?? null,
            chunkCount: input.payload.chunkCount ?? input.payload.chunk_count ?? null,
          },
        }],
        { client: supabase }
      ).catch((error) => {
        logger.warn('Material ingestion memory-card projection failed', {
          userId: input.userId,
          materialId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      })
    : [];

  await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: material.goal_id ?? null,
    sourceEventId: input.eventId ?? null,
  }).catch(() => undefined);

  await recordAgentAction({
    userId: input.userId,
    agentName: 'atlas',
    actionType: 'material_ingested',
    targetType: 'study_material',
    targetId: materialId,
    status: 'applied',
    confidence: 0.85,
    evidence: {
      conceptId: resolution.conceptId,
      cardsCreated: cards.length,
      pageCount: material.page_count,
      charCount: material.char_count,
    },
    idempotencyKey: `material_projection:${input.userId}:${materialId}`,
  }, { client: supabase }).catch(() => undefined);

  return {
    conceptsUpdated,
    cardsCreated: cards.length,
    reason: 'projected_material_ingestion',
  };
}

export async function projectPracticeAttemptToStudyState(input: {
  userId: string;
  payload: Record<string, any>;
  eventId?: string | null;
  client?: SupabaseLike;
}) {
  const supabase = input.client ?? createAdminClient();
  const practiceSetId = asString(input.payload.practiceSetId ?? input.payload.practice_set_id);
  const items = Array.isArray(input.payload.items) ? input.payload.items : [];
  if (!practiceSetId || items.length === 0) {
    await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
      client: supabase,
      goalId: asString(input.payload.goalId ?? input.payload.goal_id),
      sourceEventId: input.eventId ?? null,
    }).catch(() => undefined);
    return { wrongItems: 0, mistakesCreated: 0, conceptsTouched: 0 };
  }

  const summary = await syncStudyProfileAfterPracticeAttempt(supabase, {
    userId: input.userId,
    goalId: asString(input.payload.goalId ?? input.payload.goal_id),
    practiceSetId,
    metrics: {
      correctCount: numberOr(input.payload.metrics?.correctCount, items.filter((item: any) => item.isCorrect === true).length),
      wrongCount: numberOr(input.payload.metrics?.wrongCount, items.filter((item: any) => item.isCorrect === false).length),
      wrongConceptIds: Array.isArray(input.payload.metrics?.wrongConceptIds) ? input.payload.metrics.wrongConceptIds : [],
      wrongConceptNames: Array.isArray(input.payload.metrics?.wrongConceptNames) ? input.payload.metrics.wrongConceptNames : [],
    },
    items,
  });

  return summary;
}
