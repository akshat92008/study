import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import type { CheapAgentAction, CheapAgentCycleResult } from './cheap-types';
import { classifyAgentAction, normalizeActionPolicy, shouldSkipAgentMutation } from './policy';
import { assertBetaAgentActionAllowed } from './beta-policy';

type SupabaseLike = ReturnType<typeof createAdminClient>;

type ExecuteOptions = {
  client?: SupabaseLike;
};

const AGENT_NAME_MAP: Record<string, string> = {
  MEMORY: 'memory',
  ATLAS: 'atlas',
  AUTOPSY: 'autopsy',
  REVISION: 'revision',
  COMMAND: 'command',
  PULSE: 'pulse',
  MIND: 'mind',
};

export async function executeAgentActions(
  actions: CheapAgentAction[],
  options: ExecuteOptions = {}
): Promise<CheapAgentCycleResult> {
  const result: CheapAgentCycleResult = {
    applied: 0,
    proposed: 0,
    skipped: 0,
    failed: 0,
    actions: [],
  };

  for (const action of actions) {
    const betaPolicy = assertBetaAgentActionAllowed(action.actionType);
    if (!betaPolicy.allowed) {
      result.skipped++;
      result.actions.push(actionSummary(action, 'SKIPPED_INTENTIONALLY', betaPolicy.reason));
      continue;
    }

    const policy = normalizeActionPolicy(action);
    if (shouldSkipAgentMutation()) {
      result.skipped++;
      result.actions.push(actionSummary(action, 'skipped', 'Agent actions disabled.'));
      continue;
    }

    if (!policy.autoApply) {
      await persistAgentAction({
        ...action,
        riskLevel: policy.riskLevel,
        status: 'proposed',
      }, options);
      result.proposed++;
      result.actions.push(actionSummary(action, 'proposed', action.reason));
      continue;
    }

    try {
      const afterState = await applySafeAction(action, options);
      await persistAgentAction({
        ...action,
        riskLevel: 'safe',
        status: 'applied',
        payload: { ...action.payload, afterState },
      }, options);
      result.applied++;
      result.actions.push(actionSummary(action, 'applied', action.reason));
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Action application failed.';
      logger.warn('Cheap agent action failed', {
        actionType: action.actionType,
        agent: action.agent,
        userId: action.userId,
        reason,
      });
      await persistAgentAction({
        ...action,
        status: 'failed',
        reason,
      }, options).catch((persistError) => {
        logger.warn('Failed to persist failed agent action', {
          actionType: action.actionType,
          userId: action.userId,
          persistError: persistError instanceof Error ? persistError.message : String(persistError),
        });
      });
      result.failed++;
      result.actions.push(actionSummary(action, 'failed', reason));
    }
  }

  return result;
}

export async function persistAgentAction(action: CheapAgentAction, options: ExecuteOptions = {}) {
  const supabase = options.client ?? createAdminClient();
  const policy = classifyAgentAction(action.actionType);
  const riskLevel = action.riskLevel ?? policy.riskLevel;
  const approvalRequired = riskLevel !== 'safe' || !policy.autoApply;
  const status = toDbStatus(action.status ?? (approvalRequired ? 'proposed' : 'applied'));
  const idempotencyKey = idempotencyKeyFor(action);
  const now = new Date().toISOString();
  const afterState = recordFrom(action.payload.afterState);

  const row = {
    run_id: null,
    event_id: action.eventId ?? null,
    user_id: action.userId,
    agent_name: AGENT_NAME_MAP[action.agent] ?? 'system',
    action_type: action.actionType,
    target_type: stringOrNull(action.payload.targetType),
    target_id: uuidOrNull(action.payload.targetId ?? action.payload.conceptId ?? action.payload.materialId),
    status,
    risk_level: riskLevel === 'safe' ? 'safe_auto' : 'requires_approval',
    approval_status: approvalRequired && status !== 'skipped' && status !== 'failed' ? 'pending' : 'not_required',
    confidence: clamp(Number(action.confidence ?? 0.7), 0, 1),
    evidence: action.payload,
    reason: action.reason,
    before_state: {},
    after_state: afterState,
    idempotency_key: idempotencyKey,
    applied_at: status === 'applied' ? now : null,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('agent_actions')
    .upsert(row, { onConflict: 'user_id,action_type,idempotency_key' })
    .select('*')
    .single();

  if (error) throw error;
  return data;
}

export async function applySafeAction(action: CheapAgentAction, options: ExecuteOptions = {}) {
  const policy = classifyAgentAction(action.actionType);
  if (!policy.autoApply) {
    throw new Error(`Action ${action.actionType} requires approval.`);
  }

  const supabase = options.client ?? createAdminClient();

  switch (action.actionType) {
    case 'record_learning_evidence':
      return recordLearningEvidence(supabase, action);
    case 'update_mastery_score':
    case 'update_mastery_from_evidence':
      return updateMasteryScore(supabase, action);
    case 'tag_weak_topic':
      return tagWeakTopic(supabase, action);
    case 'record_mistake_pattern':
      return recordMistakePattern(supabase, action);
    case 'create_revision_due_item':
    case 'create_revision_card_from_verified_mistake':
      return createRevisionDueItem(supabase, action);
    case 'update_revision_priority':
      return updateRevisionPriority(supabase, action);
    case 'invalidate_today_mission':
    case 'invalidate_session_card':
      return invalidateTodayMission(supabase, action);
    case 'increase_topic_priority':
      return increaseTopicPriority(supabase, action);
    case 'mark_concept_practiced':
      return markConceptPracticed(supabase, action);
    case 'flag_student_risk':
      return flagStudentRisk(supabase, action);
    default:
      throw new Error(`Unknown safe action: ${action.actionType}`);
  }
}

export async function applyApprovedAgentAction(
  actionId: string,
  userId: string,
  options: ExecuteOptions = {}
) {
  const supabase = options.client ?? createAdminClient();
  const { data: action, error } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!action) throw new Error('Agent action not found.');
  if (!['proposed', 'pending_approval', 'approved'].includes(action.status)) {
    throw new Error('Agent action is not awaiting approval.');
  }
  if (action.approval_status === 'rejected') {
    throw new Error('Rejected actions cannot be applied.');
  }

  const betaPolicy = assertBetaAgentActionAllowed(action.action_type);
  if (!betaPolicy.allowed) {
    return {
      ...action,
      status: 'skipped',
      reason: betaPolicy.reason,
    };
  }

  if (action.action_type === 'replace_daily_plan') {
    const applied = await applyApprovedDailyPlan(supabase, action);
    const { data, error: updateError } = await supabase
      .from('agent_actions')
      .update({
        status: 'applied',
        approval_status: 'approved',
        applied_at: new Date().toISOString(),
        after_state: applied,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (updateError) throw updateError;
    return data;
  }

  return action;
}

async function recordLearningEvidence(supabase: SupabaseLike, action: CheapAgentAction) {
  const payload = action.payload;
  const row = {
    user_id: action.userId,
    source_type: stringOrNull(payload.sourceType) ?? 'agent_event',
    source_id: stringOrNull(payload.sourceId),
    subject: stringOrNull(payload.subject),
    chapter: stringOrNull(payload.chapter),
    topic: stringOrNull(payload.topic),
    evidence_type: stringOrNull(payload.evidenceType) ?? 'learning_signal',
    score: numberOrNull(payload.score),
    confidence: clamp(Number(action.confidence ?? payload.confidence ?? 0.7), 0, 1),
    payload: recordFrom(payload.raw) ?? payload,
  };
  const { data, error } = await supabase.from('learning_evidence').insert(row).select('id').single();
  if (error) throw error;
  return { learningEvidenceId: data?.id ?? null };
}

async function updateMasteryScore(supabase: SupabaseLike, action: CheapAgentAction) {
  const payload = action.payload;
  const existing = await fetchStudentMastery(supabase, action.userId, payload);
  const oldScore = numberOrNull(existing?.mastery_score) ?? 0.5;
  const delta = numberOrNull(payload.delta) ?? 0;
  const newScore = clamp(oldScore + delta, 0.05, 0.95);
  const attempts = (numberOrNull(existing?.attempts_count) ?? 0) + 1;
  const correct = (numberOrNull(existing?.correct_count) ?? 0) + (payload.isCorrect === true ? 1 : 0);
  const now = new Date().toISOString();

  const row = {
    user_id: action.userId,
    subject: stringOrNull(payload.subject),
    chapter: stringOrNull(payload.chapter),
    topic: stringOrNull(payload.topic ?? payload.conceptName),
    mastery_score: newScore,
    confidence: clamp(0.45 + attempts * 0.04, 0.45, 0.9),
    attempts_count: attempts,
    correct_count: correct,
    last_practiced_at: now,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from('student_mastery')
    .upsert(row, { onConflict: 'user_id,subject,chapter,topic' })
    .select('id, mastery_score')
    .single();
  if (error) throw error;

  const conceptId = uuidOrNull(payload.conceptId);
  if (conceptId) {
    await supabase
      .from('concepts')
      .update({
        mastery_score: Math.round(newScore * 100),
        mastery: masteryLabel(newScore),
        updated_at: now,
      })
      .eq('id', conceptId)
      .eq('user_id', action.userId);
  }

  return { oldScore, newScore, studentMasteryId: data?.id ?? null };
}

async function tagWeakTopic(supabase: SupabaseLike, action: CheapAgentAction) {
  const payload = action.payload;
  const now = new Date().toISOString();
  const row = {
    user_id: action.userId,
    subject: stringOrNull(payload.subject),
    chapter: stringOrNull(payload.chapter),
    topic: stringOrNull(payload.topic ?? payload.conceptName),
    mastery_score: 0.35,
    confidence: 0.7,
    attempts_count: 1,
    correct_count: 0,
    last_practiced_at: now,
    updated_at: now,
  };
  const { data, error } = await supabase
    .from('student_mastery')
    .upsert(row, { onConflict: 'user_id,subject,chapter,topic' })
    .select('id')
    .single();
  if (error) throw error;
  return { studentMasteryId: data?.id ?? null, weak: true };
}

async function recordMistakePattern(supabase: SupabaseLike, action: CheapAgentAction) {
  const payload = action.payload;
  const existing = await supabase
    .from('mistake_patterns')
    .select('id, occurrences')
    .eq('user_id', action.userId)
    .eq('subject', stringOrNull(payload.subject))
    .eq('chapter', stringOrNull(payload.chapter))
    .eq('topic', stringOrNull(payload.topic ?? payload.conceptName))
    .eq('pattern_type', stringOrNull(payload.patternType) ?? 'conceptual_gap')
    .maybeSingle();
  if (existing.error) throw existing.error;

  const row = {
    user_id: action.userId,
    subject: stringOrNull(payload.subject),
    chapter: stringOrNull(payload.chapter),
    topic: stringOrNull(payload.topic ?? payload.conceptName),
    pattern_type: stringOrNull(payload.patternType) ?? 'conceptual_gap',
    severity: clamp(Number(payload.severity ?? 0.5), 0, 1),
    occurrences: (numberOrNull(existing.data?.occurrences) ?? 0) + 1,
    last_seen_at: new Date().toISOString(),
    payload,
  };
  const { data, error } = await supabase
    .from('mistake_patterns')
    .upsert(row, { onConflict: 'user_id,subject,chapter,topic,pattern_type' })
    .select('id, occurrences')
    .single();
  if (error) throw error;
  return { mistakePatternId: data?.id ?? null, occurrences: data?.occurrences ?? row.occurrences };
}

async function createRevisionDueItem(supabase: SupabaseLike, action: CheapAgentAction) {
  const payload = action.payload;
  const sourceType = stringOrNull(payload.sourceType) ?? 'cheap_agent_revision';
  const sourceId = stringOrNull(payload.sourceId) ?? idempotencyKeyFor(action);
  const existing = await supabase
    .from('revision_cards')
    .select('id')
    .eq('user_id', action.userId)
    .eq('source_type', sourceType)
    .eq('source_id', sourceId)
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return { revisionCardId: existing.data.id, existing: true };

  const { data, error } = await supabase
    .from('revision_cards')
    .insert({
      user_id: action.userId,
      concept_id: uuidOrNull(payload.conceptId),
      front: stringOrNull(payload.front) ?? `Recall ${stringOrNull(payload.topic ?? payload.conceptName) ?? 'this concept'}`,
      back: stringOrNull(payload.back) ?? 'Review the source mistake, then solve one similar question.',
      due: stringOrNull(payload.dueAt) ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      source_type: sourceType,
      source_id: sourceId,
      metadata: {
        agent: action.agent,
        priority: stringOrNull(payload.priority) ?? 'medium',
        subject: stringOrNull(payload.subject),
        chapter: stringOrNull(payload.chapter),
        topic: stringOrNull(payload.topic ?? payload.conceptName),
      },
    })
    .select('id')
    .single();
  if (error) throw error;
  return { revisionCardId: data?.id ?? null, existing: false };
}

async function updateRevisionPriority(supabase: SupabaseLike, action: CheapAgentAction) {
  const created = await createRevisionDueItem(supabase, action);
  if (!created.revisionCardId) return created;
  const { error } = await supabase
    .from('revision_cards')
    .update({
      due: stringOrNull(action.payload.dueAt) ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      metadata: {
        priority: stringOrNull(action.payload.priority) ?? 'high',
        updatedBy: action.agent,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', created.revisionCardId)
    .eq('user_id', action.userId);
  if (error) throw error;
  return { ...created, priorityUpdated: true };
}

async function invalidateTodayMission(supabase: SupabaseLike, action: CheapAgentAction) {
  const missionDate = stringOrNull(action.payload.missionDate) ?? new Date().toISOString().slice(0, 10);
  const row = {
    user_id: action.userId,
    mission_date: missionDate,
    status: 'stale',
    source: 'rule_agent',
    payload: {
      invalidationReason: stringOrNull(action.payload.reasonCode) ?? 'agent_signal',
      sourceEventId: action.eventId ?? null,
      subject: stringOrNull(action.payload.subject),
      chapter: stringOrNull(action.payload.chapter),
      topic: stringOrNull(action.payload.topic),
    },
    invalidated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase
    .from('daily_missions')
    .upsert(row, { onConflict: 'user_id,mission_date' })
    .select('id')
    .single();
  if (error) throw error;
  return { dailyMissionId: data?.id ?? null, status: 'stale' };
}

async function increaseTopicPriority(supabase: SupabaseLike, action: CheapAgentAction) {
  const taskDate = new Date().toISOString().slice(0, 10);
  const title = `Review ${stringOrNull(action.payload.topic ?? action.payload.conceptName) ?? stringOrNull(action.payload.chapter) ?? 'weak topic'}`;
  const existing = await supabase
    .from('daily_microtasks')
    .select('id')
    .eq('user_id', action.userId)
    .eq('task_date', taskDate)
    .eq('title', title)
    .eq('source', 'rule_agent')
    .maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) return { dailyMicrotaskId: existing.data.id, existing: true };

  const { data, error } = await supabase
    .from('daily_microtasks')
    .insert({
      user_id: action.userId,
      task_date: taskDate,
      title,
      subject: stringOrNull(action.payload.subject),
      topic: stringOrNull(action.payload.topic ?? action.payload.chapter),
      concept_id: uuidOrNull(action.payload.conceptId),
      type: 'revision',
      estimated_minutes: 20,
      status: 'pending',
      priority: stringOrNull(action.payload.priority) ?? 'medium',
      source: 'rule_agent',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { dailyMicrotaskId: data?.id ?? null, existing: false };
}

async function markConceptPracticed(supabase: SupabaseLike, action: CheapAgentAction) {
  const now = new Date().toISOString();
  const conceptId = uuidOrNull(action.payload.conceptId);
  if (conceptId) {
    const { error } = await supabase
      .from('concepts')
      .update({
        last_reviewed_at: now,
        updated_at: now,
      })
      .eq('id', conceptId)
      .eq('user_id', action.userId);
    if (error) throw error;
  }

  return updateMasteryScore(supabase, {
    ...action,
    actionType: 'update_mastery_score',
    payload: { ...action.payload, delta: 0.02, isCorrect: true },
  });
}

async function flagStudentRisk(supabase: SupabaseLike, action: CheapAgentAction) {
  const { data, error } = await supabase
    .from('learning_evidence')
    .insert({
      user_id: action.userId,
      source_type: 'pulse_rule_agent',
      source_id: action.eventId ?? idempotencyKeyFor(action),
      subject: stringOrNull(action.payload.subject),
      chapter: stringOrNull(action.payload.chapter),
      topic: stringOrNull(action.payload.topic),
      evidence_type: stringOrNull(action.payload.riskType) ?? 'study_risk',
      score: numberOrNull(action.payload.evidenceCount),
      confidence: action.confidence,
      payload: action.payload,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { learningEvidenceId: data?.id ?? null, riskType: action.payload.riskType };
}

async function applyApprovedDailyPlan(supabase: SupabaseLike, action: any) {
  const evidence = recordFrom(action.evidence) ?? {};
  const missionDate = stringOrNull(evidence.missionDate) ?? new Date().toISOString().slice(0, 10);
  const blocks = Array.isArray(evidence.blocks) ? evidence.blocks : [];

  const { data: mission, error } = await supabase
    .from('daily_missions')
    .upsert({
      user_id: action.user_id,
      mission_date: missionDate,
      status: 'approved',
      source: 'approved_agent_action',
      payload: {
        blocks,
        approvedActionId: action.id,
      },
      invalidated_at: null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,mission_date' })
    .select('id')
    .single();
  if (error) throw error;

  const tasks = blocks
    .filter((block): block is Record<string, unknown> => Boolean(block) && typeof block === 'object')
    .slice(0, 12)
    .map((block) => ({
      user_id: action.user_id,
      task_date: missionDate,
      title: stringOrNull(block.title) ?? `Study ${stringOrNull(block.topic ?? block.chapter ?? block.subject) ?? 'priority topic'}`,
      subject: stringOrNull(block.subject),
      topic: stringOrNull(block.topic ?? block.chapter),
      type: stringOrNull(block.type) ?? 'revision',
      estimated_minutes: Math.max(5, Math.min(180, Number(block.durationMinutes ?? 30))),
      status: 'pending',
      priority: 'high',
      source: 'approved_agent_action',
    }));

  if (tasks.length > 0) {
    await supabase
      .from('daily_microtasks')
      .delete()
      .eq('user_id', action.user_id)
      .eq('task_date', missionDate)
      .eq('source', 'approved_agent_action');
    const { error: taskError } = await supabase.from('daily_microtasks').insert(tasks);
    if (taskError) throw taskError;
  }

  return { dailyMissionId: mission?.id ?? null, taskCount: tasks.length };
}

async function fetchStudentMastery(supabase: SupabaseLike, userId: string, payload: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('student_mastery')
    .select('*')
    .eq('user_id', userId)
    .eq('subject', stringOrNull(payload.subject))
    .eq('chapter', stringOrNull(payload.chapter))
    .eq('topic', stringOrNull(payload.topic ?? payload.conceptName))
    .maybeSingle();
  if (error) throw error;
  return data;
}

function idempotencyKeyFor(action: CheapAgentAction) {
  const payload = action.payload;
  const source = stringOrNull(payload.sourceId ?? payload.sourceEventId ?? action.eventId)
    ?? `${stringOrNull(payload.subject) ?? 'subject'}:${stringOrNull(payload.chapter) ?? 'chapter'}:${stringOrNull(payload.topic ?? payload.conceptName) ?? 'topic'}`;
  return [
    'cheap_agent',
    action.agent,
    action.actionType,
    action.eventId ?? 'no_event',
    source,
  ].join(':').slice(0, 240);
}

function toDbStatus(status: string) {
  if (status === 'approved' || status === 'applied' || status === 'rejected' || status === 'skipped' || status === 'failed') {
    return status;
  }
  return 'proposed';
}

function actionSummary(action: CheapAgentAction, status: string, reason?: string) {
  return {
    agent: action.agent,
    actionType: action.actionType,
    status,
    reason,
  };
}

function masteryLabel(score: number) {
  if (score >= 0.9) return 'automated';
  if (score >= 0.75) return 'mastered';
  if (score >= 0.6) return 'proficient';
  if (score >= 0.35) return 'developing';
  if (score > 0.1) return 'exposed';
  return 'not_started';
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function stringOrNull(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function uuidOrNull(value: unknown): string | null {
  const text = stringOrNull(value);
  return text && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)
    ? text
    : null;
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function recordFrom(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}
