import { createHash } from 'node:crypto';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { recordMasteryEvidence } from '@/lib/engines/mastery-updater';

export type RepairSource = 'quiz' | 'autopsy' | 'chat' | 'manual' | 'diagnostic';
export type RepairStatus = 'open' | 'repairing' | 'retest_due' | 'repaired' | 'ignored';
export type RetestStatus = 'due' | 'passed' | 'failed';

const ACTIVE_REPAIR_STATUSES = ['open', 'repairing', 'retest_due', 'verified_mistake', 'pending_review'] as const;

export interface MistakeRiskInput {
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
  source: RepairSource;
  subject?: string | null;
  topic?: string | null;
  chapter?: string | null;
  concept?: string | null;
  conceptId?: string | null;
  mistakeText: string;
  questionText?: string | null;
  userAnswer?: string | null;
  correctAnswer?: string | null;
  whyWrong?: string | null;
  examTrap?: string | null;
  severity?: number | null;
  category?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
  invalidateSession?: boolean;
}

export interface MistakeRiskResult {
  mistake: any;
  created: boolean;
  revisionCardCreated: boolean;
  retestScheduled: boolean;
  retest: any | null;
}

export interface RepairSignals {
  dueRetests: any[];
  activeMistakes: any[];
}

function clampSeverity(value?: number | null) {
  const n = Number(value ?? 1);
  if (!Number.isFinite(n)) return 1;
  return Math.min(5, Math.max(1, Math.round(n)));
}

export function normalizeRepairText(value?: string | null) {
  return (value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function buildMistakeNormalizedKey(input: { concept?: string | null; mistakeText: string }) {
  const concept = normalizeRepairText(input.concept || 'unclassified concept');
  const mistake = normalizeRepairText(input.mistakeText || 'unspecified mistake');
  return createHash('sha256').update(`${concept}\n${mistake}`).digest('hex');
}

function buildRetestQuestion(mistake: any) {
  const concept = mistake.concept || mistake.topic || mistake.chapter || 'this concept';
  if (mistake.correct_answer) {
    return `Retest: ${mistake.mistake_text || mistake.question_text}\nWhat is the correct answer or rule?`;
  }
  return `Retest: Explain the correct rule for ${concept} without looking at notes.`;
}

function repairCardFront(mistake: any) {
  const concept = mistake.concept || mistake.topic || mistake.chapter || 'Mistake repair';
  return `[Mistake Repair] ${concept}: ${mistake.mistake_text || mistake.question_text || 'What went wrong?'}`;
}

function repairCardBack(mistake: any) {
  return [
    mistake.correct_answer ? `Correct answer: ${mistake.correct_answer}` : null,
    mistake.why_wrong || mistake.ai_analysis ? `Why it was wrong: ${mistake.why_wrong || mistake.ai_analysis}` : null,
    mistake.exam_trap ? `Exam trap: ${mistake.exam_trap}` : null,
    mistake.improvement_suggestion || 'Repair it, answer an immediate recall check, then pass the delayed retest.',
  ].filter(Boolean).join('\n');
}

function revisionOriginFor(source: RepairSource): 'manual' | 'chat' | 'autopsy' | 'practice' | 'source' {
  if (source === 'quiz' || source === 'diagnostic') return 'practice';
  if (source === 'chat' || source === 'autopsy' || source === 'manual') return source;
  return 'manual';
}

function dbMistakeType(value?: string | null) {
  switch (value) {
    case 'concept_gap':
    case 'conceptual':
    case 'incomplete_knowledge':
      return 'conceptual_gap';
    case 'memory_gap':
    case 'recall_failure':
    case 'lack_of_revision':
      return 'formula_recall';
    case 'calculation':
      return 'calculation_error';
    case 'misread':
      return 'misread_question';
    case 'silly':
    case 'silly_error':
      return 'silly_mistake';
    case 'poor_elimination':
      return 'option_trap';
    case 'guessed':
    case 'overconfidence':
      return 'low_confidence_guess';
    case 'weak_application':
    case 'application':
      return 'application_failure';
    case 'time_pressure':
    case 'calculation_error':
    case 'misread_question':
    case 'option_trap':
    case 'forgot_fact':
    case 'application_failure':
    case 'low_confidence_guess':
    case 'unknown':
      return value;
    default:
      return 'conceptual_gap';
  }
}

function nextDayIso(now = new Date()) {
  return new Date(now.getTime() + 86_400_000).toISOString();
}

async function fetchExistingMistake(supabase: any, input: MistakeRiskInput, normalizedKey: string) {
  const byKey = await supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', input.userId)
    .eq('normalized_key', normalizedKey)
    .maybeSingle();
  if (byKey.data) return byKey.data;

  let fallback = supabase
    .from('mistakes')
    .select('*')
    .eq('user_id', input.userId)
    .eq('concept', input.concept || input.topic || input.chapter || 'Unclassified concept')
    .eq('mistake_text', input.mistakeText);

  fallback = input.goalId
    ? fallback.eq('goal_id', input.goalId)
    : typeof fallback.is === 'function'
      ? fallback.is('goal_id', null)
      : fallback;

  const { data } = await fallback.maybeSingle();
  return data ?? null;
}

export async function upsertMistakeRisk(
  supabase: any,
  input: MistakeRiskInput
): Promise<MistakeRiskResult> {
  const concept = input.concept || input.topic || input.chapter || 'Unclassified concept';
  const normalizedKey = buildMistakeNormalizedKey({ concept, mistakeText: input.mistakeText });
  const now = new Date().toISOString();
  const severity = clampSeverity(input.severity);
  const existing = await fetchExistingMistake(supabase, input, normalizedKey);

  let mistake: any;
  let created = false;

  if (existing?.id) {
    const occurrenceCount = Number(existing.occurrence_count ?? 1) + 1;
    const reopen = ['repaired', 'ignored', 'corrected_by_user', 'rejected'].includes(existing.status);
    const { data, error } = await supabase
      .from('mistakes')
      .update({
        source: input.source,
        subject: input.subject ?? existing.subject ?? null,
        topic: input.topic ?? existing.topic ?? null,
        chapter: input.chapter ?? input.topic ?? existing.chapter ?? null,
        concept,
        concept_id: input.conceptId ?? existing.concept_id ?? null,
        mistake_text: input.mistakeText,
        question_text: input.questionText ?? existing.question_text ?? input.mistakeText,
        user_answer: input.userAnswer ?? existing.user_answer ?? null,
        correct_answer: input.correctAnswer ?? existing.correct_answer ?? null,
        why_wrong: input.whyWrong ?? existing.why_wrong ?? null,
        exam_trap: input.examTrap ?? existing.exam_trap ?? null,
        ai_analysis: input.whyWrong ?? existing.ai_analysis ?? null,
        improvement_suggestion: input.examTrap ?? existing.improvement_suggestion ?? 'Repair this before attempting similar questions.',
        severity: Math.max(clampSeverity(existing.severity), severity),
        status: reopen ? 'open' : (existing.status || 'open'),
        repaired_at: reopen ? null : existing.repaired_at ?? null,
        occurrence_count: occurrenceCount,
        normalized_key: normalizedKey,
        updated_at: now,
      })
      .eq('id', existing.id)
      .eq('user_id', input.userId)
      .select('*')
      .single();
    if (error) throw error;
    mistake = data ?? existing;
  } else {
    const { data, error } = await supabase
      .from('mistakes')
      .insert({
        user_id: input.userId,
        goal_id: input.goalId ?? null,
        chat_session_id: input.chatSessionId ?? null,
        source: input.source,
        subject: input.subject ?? null,
        topic: input.topic ?? null,
        chapter: input.chapter ?? input.topic ?? null,
        concept,
        concept_id: input.conceptId ?? null,
        mistake_text: input.mistakeText,
        question_text: input.questionText ?? input.mistakeText,
        user_answer: input.userAnswer ?? null,
        correct_answer: input.correctAnswer ?? null,
        why_wrong: input.whyWrong ?? null,
        exam_trap: input.examTrap ?? null,
        category: input.category ?? 'conceptual_gap',
        status: 'open',
        severity,
        marks_lost: 1,
        total_marks: 1,
        ai_analysis: input.whyWrong ?? null,
        improvement_suggestion: input.examTrap ?? 'Repair this before attempting similar questions.',
        evidence_source: input.source,
        raw_evidence: input.metadata ?? {},
        mistake_type: dbMistakeType(input.category),
        normalized_key: normalizedKey,
        created_at: now,
        updated_at: now,
      })
      .select('*')
      .single();
    if (error) throw error;
    mistake = data;
    created = true;
  }

  const [cardResult, retest] = await Promise.all([
    ensureRepairRevisionCard(supabase, mistake, input),
    ensureDelayedRetest(supabase, mistake, { dueAt: nextDayIso(), question: buildRetestQuestion(mistake) }),
  ]);

  await supabase
    .from('mistakes')
    .update({ next_retest_at: retest?.due_at ?? nextDayIso(), updated_at: now })
    .eq('id', mistake.id)
    .eq('user_id', input.userId);

  if (input.invalidateSession !== false) {
    await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
      client: supabase,
      goalId: input.goalId ?? mistake.goal_id ?? null,
    }).catch(() => undefined);
  }

  return {
    mistake: { ...mistake, next_retest_at: retest?.due_at ?? mistake.next_retest_at },
    created,
    revisionCardCreated: cardResult.created,
    retestScheduled: Boolean(retest),
    retest,
  };
}

async function ensureRepairRevisionCard(supabase: any, mistake: any, input: MistakeRiskInput) {
  const normalizedKey = `mistake-repair:${mistake.id}`;
  const { data: existing, error: existingError } = await supabase
    .from('revision_cards')
    .select('id')
    .eq('user_id', input.userId)
    .eq('normalized_key', normalizedKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return { created: false, id: existing.id };

  const { data, error } = await supabase
    .from('revision_cards')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId ?? mistake.goal_id ?? null,
      concept_id: mistake.concept_id ?? null,
      subject: mistake.subject ?? null,
      chapter: mistake.topic ?? mistake.chapter ?? mistake.concept ?? null,
      front: repairCardFront(mistake),
      back: repairCardBack(mistake),
      due: new Date().toISOString(),
      state: 0,
      stability: 0,
      difficulty: Math.max(5, Number(mistake.severity ?? 1) + 4),
      source_type: 'mistake',
      source_id: mistake.id,
      source_hash: normalizedKey,
      normalized_key: normalizedKey,
      card_type: 'mistake_repair',
      origin: revisionOriginFor(input.source),
      tags: ['mistake-repair'],
      metadata: {
        mistakeId: mistake.id,
        retestRequired: true,
        source: input.source,
      },
    })
    .select('id')
    .single();
  if (error) throw error;
  return { created: true, id: data?.id ?? null };
}

export async function ensureDelayedRetest(
  supabase: any,
  mistake: any,
  options: { dueAt?: string; question?: string } = {}
) {
  const { data: existing, error: existingError } = await supabase
    .from('mistake_retests')
    .select('*')
    .eq('mistake_id', mistake.id)
    .eq('status', 'due')
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing;

  const { data, error } = await supabase
    .from('mistake_retests')
    .insert({
      user_id: mistake.user_id,
      goal_id: mistake.goal_id ?? null,
      mistake_id: mistake.id,
      due_at: options.dueAt ?? nextDayIso(),
      question: options.question ?? buildRetestQuestion(mistake),
      status: 'due',
      attempt_count: 0,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function startRepairSession(supabase: any, input: { userId: string; mistakeId: string }) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('mistakes')
    .update({ status: 'repairing', updated_at: now })
    .eq('id', input.mistakeId)
    .eq('user_id', input.userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function submitImmediateRepair(
  supabase: any,
  input: { userId: string; mistakeId: string; passed: boolean }
) {
  const now = new Date().toISOString();
  const { data: mistake, error: readError } = await supabase
    .from('mistakes')
    .select('*')
    .eq('id', input.mistakeId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (readError) throw readError;
  if (!mistake) throw new Error('Mistake not found');

  if (!input.passed) {
    await supabase
      .from('mistakes')
      .update({ status: 'repairing', updated_at: now })
      .eq('id', mistake.id)
      .eq('user_id', input.userId);
    return {
      status: 'repairing' as RepairStatus,
      message: 'Immediate repair is still open. Review the repair card, then try the recall check again.',
    };
  }

  const retest = await ensureDelayedRetest(supabase, mistake, { dueAt: nextDayIso(), question: buildRetestQuestion(mistake) });
  await supabase
    .from('mistakes')
    .update({
      status: 'retest_due',
      next_retest_at: retest.due_at,
      last_tested_at: now,
      updated_at: now,
    })
    .eq('id', mistake.id)
    .eq('user_id', input.userId);

  await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: mistake.goal_id ?? null,
  }).catch(() => undefined);

  return {
    status: 'retest_due' as RepairStatus,
    retest,
    message: 'Immediate repair passed. Retest scheduled for tomorrow. This mistake is not considered repaired yet.',
  };
}

export async function submitDelayedRetest(
  supabase: any,
  input: { userId: string; mistakeId?: string | null; retestId?: string | null; passed: boolean }
) {
  const now = new Date().toISOString();
  let retestQuery = supabase
    .from('mistake_retests')
    .select('*')
    .eq('user_id', input.userId);
  retestQuery = input.retestId
    ? retestQuery.eq('id', input.retestId)
    : retestQuery.eq('mistake_id', input.mistakeId).eq('status', 'due');

  const { data: retest, error: retestError } = await retestQuery.maybeSingle();
  if (retestError) throw retestError;
  if (!retest) throw new Error('Retest not found');

  const { data: mistake, error: mistakeError } = await supabase
    .from('mistakes')
    .select('*')
    .eq('id', retest.mistake_id)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (mistakeError) throw mistakeError;
  if (!mistake) throw new Error('Mistake not found');

  await supabase
    .from('mistake_retests')
    .update({
      status: input.passed ? 'passed' : 'failed',
      attempt_count: Number(retest.attempt_count ?? 0) + 1,
      last_attempted_at: now,
      updated_at: now,
    })
    .eq('id', retest.id)
    .eq('user_id', input.userId);

  if (input.passed) {
    await supabase
      .from('mistakes')
      .update({
        status: 'repaired',
        repaired_at: now,
        last_tested_at: now,
        next_retest_at: null,
        updated_at: now,
      })
      .eq('id', mistake.id)
      .eq('user_id', input.userId);

    await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
      client: supabase,
      goalId: mistake.goal_id ?? null,
    }).catch(() => undefined);

    return {
      status: 'repaired' as RepairStatus,
      message: 'Repaired. You are no longer at risk of losing this mark.',
    };
  }

  await penalizeConceptMastery(supabase, mistake);
  await supabase
    .from('mistakes')
    .update({
      status: 'repairing',
      last_tested_at: now,
      next_retest_at: null,
      severity: Math.min(5, Number(mistake.severity ?? 1) + 1),
      repaired_at: null,
      updated_at: now,
    })
    .eq('id', mistake.id)
    .eq('user_id', input.userId);

  await invalidateSessionCard(input.userId, 'LEARNER_STATE_UPDATED', {
    client: supabase,
    goalId: mistake.goal_id ?? null,
  }).catch(() => undefined);

  return {
    status: 'repairing' as RepairStatus,
    message: 'Retest failed. The mistake is reopened for repair and mastery has been decreased.',
  };
}

async function penalizeConceptMastery(supabase: any, mistake: any) {
  if (!mistake.concept_id) return;
  const { data: concept } = await supabase
    .from('concepts')
    .select('mastery_score')
    .eq('id', mistake.concept_id)
    .eq('user_id', mistake.user_id)
    .maybeSingle();
  const score = Number(concept?.mastery_score ?? 0);
  const delta = score > 1 ? 8 : 0.08;
  await supabase
    .from('concepts')
    .update({
      mastery_score: Math.max(0, score - delta),
      mastery: score - delta <= 0.2 ? 'exposed' : 'developing',
      updated_at: new Date().toISOString(),
    })
    .eq('id', mistake.concept_id)
    .eq('user_id', mistake.user_id);

  await recordMasteryEvidence({
    userId: mistake.user_id,
    conceptId: mistake.concept_id,
    evidenceType: 'practice_wrong',
    source: 'mistake_retest',
    sourceId: `mistake_retest_failed:${mistake.id}:${mistake.last_tested_at ?? Date.now()}`,
    evidence: `Failed delayed retest for ${mistake.concept || mistake.topic || 'mistake repair'}.`,
    confidence: 0.82,
    client: supabase,
  }).catch(() => undefined);
}

export async function getRepairSignals(
  supabase: any,
  input: { userId: string; goalId?: string | null; now?: string; limit?: number }
): Promise<RepairSignals> {
  const now = input.now ?? new Date().toISOString();
  const limit = input.limit ?? 10;

  let retestQuery = supabase
    .from('mistake_retests')
    .select('*')
    .eq('user_id', input.userId)
    .eq('status', 'due')
    .lte('due_at', now)
    .order('due_at', { ascending: true })
    .limit(limit);
  if (input.goalId) retestQuery = retestQuery.eq('goal_id', input.goalId);

  let mistakesQuery = supabase
    .from('mistakes')
    .select('id, user_id, goal_id, source, subject, topic, chapter, concept, concept_id, mistake_text, correct_answer, why_wrong, exam_trap, severity, status, last_tested_at, next_retest_at, repaired_at, created_at, updated_at, category, mistake_type')
    .eq('user_id', input.userId)
    .in('status', [...ACTIVE_REPAIR_STATUSES])
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit);
  if (input.goalId) mistakesQuery = mistakesQuery.eq('goal_id', input.goalId);

  const [retestsRes, mistakesRes] = await Promise.all([retestQuery, mistakesQuery]);
  const dueRetests = retestsRes.data ?? [];
  const activeMistakes = (mistakesRes.data ?? []).filter((mistake: any) => {
    if (mistake.status !== 'retest_due') return true;
    if (!mistake.next_retest_at) return false;
    return new Date(mistake.next_retest_at).getTime() <= new Date(now).getTime();
  });

  if (dueRetests.length === 0) {
    return { dueRetests, activeMistakes };
  }

  const mistakeIds = Array.from(new Set(dueRetests.map((row: any) => row.mistake_id).filter(Boolean)));
  const { data: retestMistakes } = await supabase
    .from('mistakes')
    .select('id, user_id, goal_id, source, subject, topic, chapter, concept, concept_id, mistake_text, correct_answer, why_wrong, exam_trap, severity, status, last_tested_at, next_retest_at, repaired_at, created_at, updated_at, category, mistake_type')
    .eq('user_id', input.userId)
    .in('id', mistakeIds);

  const mistakeById = new Map((retestMistakes ?? []).map((mistake: any) => [mistake.id, mistake]));
  return {
    dueRetests: dueRetests.map((retest: any) => ({
      ...retest,
      mistake: mistakeById.get(retest.mistake_id) ?? null,
    })),
    activeMistakes,
  };
}
