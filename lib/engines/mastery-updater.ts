import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { invalidateSessionCards } from '@/lib/services/session-card-cache';
import { recordAgentAction } from '@/lib/agents/agent-runtime';
import { createHash } from 'node:crypto';

export type MasterySource =
  | 'session_close'
  | 'card_review'
  | 'autopsy'
  | 'onboarding'
  | 'tutor_session'
  | 'practice'
  | 'command';

export type MasteryEvidenceType =
  | 'autopsy_wrong_answer'
  | 'autopsy_correct_answer'
  | 'repeated_mistake'
  | 'revision_easy'
  | 'revision_good'
  | 'revision_hard'
  | 'revision_again'
  | 'tutor_understood'
  | 'tutor_confused'
  | 'practice_correct'
  | 'practice_wrong'
  | 'session_completed'
  | 'remediation_completed'
  | 'time_decay'
  | 'forgetting_signal';

export type MasteryLevel =
  | 'not_started'
  | 'exposed'
  | 'developing'
  | 'proficient'
  | 'mastered'
  | 'automated';

const MASTERY_ORDER: MasteryLevel[] = [
  'not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated',
];

const LEVEL_SCORES: Record<MasteryLevel, number> = {
  not_started: 0,
  exposed: 12,
  developing: 35,
  proficient: 65,
  mastered: 86,
  automated: 96,
};

const EVIDENCE_WEIGHTS: Record<MasteryEvidenceType, number> = {
  autopsy_wrong_answer: -18,
  autopsy_correct_answer: 8,
  repeated_mistake: -28,
  revision_easy: 8,
  revision_good: 6,
  revision_hard: -4,
  revision_again: -12,
  tutor_understood: 6,
  tutor_confused: -8,
  practice_correct: 14,
  practice_wrong: -14,
  session_completed: 3,
  remediation_completed: 10,
  time_decay: -6,
  forgetting_signal: -10,
};

function masteryFromScore(score: number): MasteryLevel {
  if (score >= 95) return 'automated';
  if (score >= 85) return 'mastered';
  if (score >= 60) return 'proficient';
  if (score >= 25) return 'developing';
  if (score > 0) return 'exposed';
  return 'not_started';
}

export function advanceMastery(
  current: MasteryLevel | null,
  understood: boolean
): MasteryLevel {
  const idx = current ? MASTERY_ORDER.indexOf(current) : 0;
  const safeIdx = idx === -1 ? 0 : idx;
  if (!understood) {
    return MASTERY_ORDER[Math.max(1, safeIdx - 1)];
  }
  return MASTERY_ORDER[Math.min(safeIdx + 1, 4)];
}

function inferEvidenceType(params: {
  source: MasterySource;
  oldMastery: MasteryLevel;
  requestedMastery: MasteryLevel;
  evidence?: string;
}): MasteryEvidenceType {
  if (params.source === 'autopsy') {
    return LEVEL_SCORES[params.requestedMastery] < LEVEL_SCORES[params.oldMastery]
      ? 'autopsy_wrong_answer'
      : 'autopsy_correct_answer';
  }

  if (params.source === 'card_review') {
    if (/again/i.test(params.evidence || '')) return 'revision_again';
    if (/hard/i.test(params.evidence || '')) return 'revision_hard';
    if (/easy/i.test(params.evidence || '')) return 'revision_easy';
    return 'revision_good';
  }

  if (params.source === 'practice') {
    return LEVEL_SCORES[params.requestedMastery] >= LEVEL_SCORES[params.oldMastery]
      ? 'practice_correct'
      : 'practice_wrong';
  }

  if (params.source === 'command') return 'remediation_completed';
  if (params.source === 'tutor_session' || params.source === 'session_close') {
    return LEVEL_SCORES[params.requestedMastery] >= LEVEL_SCORES[params.oldMastery]
      ? 'tutor_understood'
      : 'tutor_confused';
  }

  return 'session_completed';
}

async function getSupabase(useAdminClient?: boolean, client?: any) {
  if (client) return client;
  return useAdminClient ? createAdminClient() : await createClient();
}

function hashKey(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(value))
    .digest('hex')
    .slice(0, 32);
}

export async function recomputeConceptMastery(
  userId: string,
  conceptId: string,
  options: { useAdminClient?: boolean; client?: any } = {}
): Promise<{ oldMastery: MasteryLevel | null; newMastery: MasteryLevel | null; changed: boolean; oldScore: number; newScore: number; delta: number }> {
  const supabase = await getSupabase(options.useAdminClient, options.client);

  const { data: concept, error: conceptErr } = await supabase
    .from('concepts')
    .select('mastery, mastery_score')
    .eq('id', conceptId)
    .eq('user_id', userId)
    .maybeSingle();

  if (conceptErr || !concept) {
    logger.warn('recomputeConceptMastery: concept not found', { userId, conceptId });
    return { oldMastery: null, newMastery: null, changed: false, oldScore: 0, newScore: 0, delta: 0 };
  }

  const { data: events, error: eventsErr } = await supabase
    .from('mastery_events')
    .select('evidence_type, weight, created_at')
    .eq('user_id', userId)
    .eq('concept_id', conceptId)
    .order('created_at', { ascending: true })
    .limit(200);

  if (eventsErr) {
    logger.warn('recomputeConceptMastery: failed to read evidence', { userId, conceptId, eventsErr });
    return { 
      oldMastery: concept.mastery as MasteryLevel, 
      newMastery: concept.mastery as MasteryLevel, 
      changed: false,
      oldScore: concept.mastery_score || 0,
      newScore: concept.mastery_score || 0,
      delta: 0
    };
  }

  const weightedScore = (events || []).reduce((sum: number, event: any) => {
    const evidenceType = event.evidence_type as MasteryEvidenceType | null;
    const baseWeight = evidenceType ? EVIDENCE_WEIGHTS[evidenceType] ?? 0 : 0;
    return sum + Number(event.weight ?? baseWeight);
  }, 0);

  const evidenceCount = events?.length || 0;
  const score = weightedScore < 0 ? LEVEL_SCORES.exposed : Math.min(100, weightedScore);
  const confidence = Math.max(0.1, Math.min(1, 0.2 + evidenceCount * 0.08));
  const forgettingProbability = Math.max(0, Math.min(1, 1 - confidence + (score < 25 ? 0.15 : 0)));
  const newMastery = masteryFromScore(score);
  const oldMastery = concept.mastery as MasteryLevel;
  const oldScore = typeof concept.mastery_score === 'number' ? concept.mastery_score : LEVEL_SCORES[oldMastery];
  const delta = score - oldScore;

  const { error: updateErr } = await supabase
    .from('concepts')
    .update({
      mastery: newMastery,
      mastery_score: score,
      confidence: confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low',
      forgetting_probability: forgettingProbability,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', conceptId)
    .eq('user_id', userId);

  if (updateErr) {
    logger.error('recomputeConceptMastery: failed to materialize mastery', { updateErr });
    return { oldMastery, newMastery: oldMastery, changed: false, oldScore, newScore: oldScore, delta: 0 };
  }

  const changed = oldMastery !== newMastery;
  if (changed) {
    await invalidateSessionCards(userId, supabase, 'concept_mastery_recomputed');
  }

  return { oldMastery, newMastery, changed, oldScore, newScore: score, delta };
}

export async function recordMasteryEvidence(params: {
  userId: string;
  conceptId: string;
  evidenceType: MasteryEvidenceType;
  source: MasterySource;
  sourceId?: string;
  sourceEventId?: string;
  idempotencyKey?: string;
  evidence?: string;
  weight?: number;
  confidence?: number;
  useAdminClient?: boolean;
  client?: any;
}): Promise<{ oldMastery: MasteryLevel | null; newMastery: MasteryLevel | null; changed: boolean; oldScore?: number; newScore?: number; delta?: number }> {
  const supabase = await getSupabase(params.useAdminClient, params.client);

  const { data: concept } = await supabase
    .from('concepts')
    .select('mastery, mastery_score')
    .eq('id', params.conceptId)
    .eq('user_id', params.userId)
    .maybeSingle();

  const oldMastery = (concept?.mastery as MasteryLevel) ?? null;
  const oldScore = concept?.mastery_score || 0;

  const weight = params.weight ?? EVIDENCE_WEIGHTS[params.evidenceType];
  const sourceRef = params.sourceId ?? params.sourceEventId ?? params.idempotencyKey;
  if (!sourceRef) {
    logger.warn('recordMasteryEvidence: missing deterministic source/idempotency reference', {
      userId: params.userId,
      conceptId: params.conceptId,
      source: params.source,
      evidenceType: params.evidenceType,
    });
    return { oldMastery, newMastery: oldMastery, changed: false, oldScore, newScore: oldScore, delta: 0 };
  }
  const idempotencyKey = params.idempotencyKey
    ?? `mastery_ledger:${params.userId}:${params.conceptId}:${params.source}:${sourceRef}:${hashKey(params.evidenceType)}`;

  const { data: existingLedger, error: existingLedgerError } = await supabase
    .from('mastery_evidence_ledger')
    .select('id')
    .eq('user_id', params.userId)
    .eq('concept_id', params.conceptId)
    .eq('idempotency_key', idempotencyKey)
    .maybeSingle();
  if (existingLedgerError) throw existingLedgerError;
  if (existingLedger?.id) {
    return { oldMastery, newMastery: oldMastery, changed: false, oldScore, newScore: oldScore, delta: 0 };
  }

  const { error: insertErr } = await supabase
    .from('mastery_events')
    .insert({
      user_id: params.userId,
      concept_id: params.conceptId,
      old_mastery: oldMastery,
      new_mastery: oldMastery,
      source: params.source,
      source_id: params.sourceId ?? null,
      source_event_id: params.sourceEventId ?? null,
      evidence: params.evidence ?? null,
      evidence_type: params.evidenceType,
      weight,
      confidence: params.confidence ?? null,
    });

  if (insertErr) {
    logger.warn('recordMasteryEvidence: mastery_events insert failed', { insertErr });
    return { oldMastery, newMastery: oldMastery, changed: false, oldScore, newScore: oldScore, delta: 0 };
  }

  const result = await recomputeConceptMastery(params.userId, params.conceptId, {
    useAdminClient: params.useAdminClient,
    client: supabase,
  });

  await supabase.from('mastery_evidence_ledger').insert({
    user_id: params.userId,
    concept_id: params.conceptId,
    source_type: params.source,
    source_id: params.sourceId ?? null,
    source_event_id: params.sourceEventId ?? null,
    previous_mastery: result.oldScore,
    delta: result.delta,
    new_mastery: result.newScore,
    confidence: params.confidence ?? 0.5,
    evidence: {
      type: params.evidenceType,
      text: params.evidence ?? null,
      weight,
    },
    reason: params.evidence ?? null,
    idempotency_key: idempotencyKey,
  }).catch((err: any) => logger.warn('Failed to insert mastery_evidence_ledger', err));

  logger.info('Mastery evidence recorded', {
    userId: params.userId,
    conceptId: params.conceptId,
    evidenceType: params.evidenceType,
    weight,
    oldMastery: result.oldMastery,
    newMastery: result.newMastery,
  });

  return result;
}

export async function recomputeManyConcepts(
  userId: string,
  conceptIds: string[],
  options: { useAdminClient?: boolean; client?: any } = {}
): Promise<void> {
  const uniqueIds = Array.from(new Set(conceptIds.filter(Boolean)));
  for (const conceptId of uniqueIds) {
    await recomputeConceptMastery(userId, conceptId, options);
  }
}

export async function applyMasteryUpdate(params: {
  userId: string;
  conceptId: string;
  newMastery: MasteryLevel;
  source: MasterySource;
  sourceId?: string;
  sourceEventId?: string;
  idempotencyKey?: string;
  evidence?: string;
  useAdminClient?: boolean;
}): Promise<{ oldMastery: MasteryLevel | null; changed: boolean }> {
  const supabase = await getSupabase(params.useAdminClient);

  const { data: concept, error: fetchErr } = await supabase
    .from('concepts')
    .select('mastery')
    .eq('id', params.conceptId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (fetchErr || !concept) {
    logger.warn('applyMasteryUpdate: concept not found', {
      conceptId: params.conceptId,
      userId: params.userId,
    });
    return { oldMastery: null, changed: false };
  }

  const oldMastery = concept.mastery as MasteryLevel;
  const evidenceType = inferEvidenceType({
    source: params.source,
    oldMastery,
    requestedMastery: params.newMastery,
    evidence: params.evidence,
  });

  const result = await recordMasteryEvidence({
    userId: params.userId,
    conceptId: params.conceptId,
    evidenceType,
    source: params.source,
    sourceId: params.sourceId,
    sourceEventId: params.sourceEventId,
    idempotencyKey: params.idempotencyKey,
    evidence: params.evidence,
    useAdminClient: params.useAdminClient,
    client: supabase,
  });

  if (result.changed) {
    await recordAgentAction({
      userId: params.userId,
      agentName: 'atlas',
      actionType: 'mastery_updated',
      targetType: 'concept',
      targetId: params.conceptId,
      status: 'applied',
      confidence: 1.0,
      evidence: { oldMastery, newMastery: params.newMastery, source: params.source, evidence: params.evidence },
      idempotencyKey: `mastery_update_action:${params.userId}:${params.conceptId}:${params.source}:${params.sourceId ?? params.sourceEventId ?? params.idempotencyKey}`,
    }, { client: supabase }).catch(err => logger.warn('Failed to record ATLAS mastery action', err));
  }

  return { oldMastery, changed: result.changed };
}
