import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentToolContext, JsonObject, LearningSignal } from '@/lib/agent/types';
import { canonicalConceptName, inferChapterForConcept, inferSubjectForConcept, normalizeConceptText, titleizeConcept } from '@/lib/atlas/conceptResolver';

export function stableKey(parts: Array<string | number | null | undefined>) {
  return parts
    .map((part) => String(part ?? 'none').trim().replace(/[^a-zA-Z0-9:._-]+/g, '-'))
    .join(':')
    .slice(0, 240);
}

function uuidOrNull(value?: string | null) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

export async function recordAgentActivity(
  supabase: SupabaseClient,
  input: {
    userId: string;
    runId?: string | null;
    agentName: 'mind' | 'rag' | 'atlas' | 'memory' | 'autopsy' | 'planner' | 'command' | 'system';
    actionType: string;
    targetType?: string | null;
    targetId?: string | null;
    status?: 'applied' | 'skipped' | 'failed';
    confidence?: number | null;
    evidence?: JsonObject;
    reason?: string | null;
    beforeState?: JsonObject;
    afterState?: JsonObject;
    idempotencyKey: string;
  }
) {
  const now = new Date().toISOString();
  const row = {
    run_id: input.runId ?? null,
    user_id: input.userId,
    agent_name: input.agentName,
    action_type: input.actionType,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    status: input.status ?? 'applied',
    risk_level: 'safe_auto',
    approval_status: 'not_required',
    confidence: input.confidence ?? null,
    evidence: input.evidence ?? {},
    reason: input.reason ?? null,
    before_state: input.beforeState ?? {},
    after_state: input.afterState ?? {},
    idempotency_key: input.idempotencyKey,
    applied_at: now,
    created_at: now,
    updated_at: now,
  };

  const { data: existing, error: existingError } = await supabase
    .from('agent_actions')
    .select('id')
    .eq('user_id', input.userId)
    .eq('action_type', input.actionType)
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing?.id) return existing.id as string;

  const { data, error } = await supabase
    .from('agent_actions')
    .insert(row)
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export function eventSignalType(eventType: string, channel: string) {
  if (eventType === 'practice_attempt_submitted') return 'practice_attempt';
  if (eventType === 'source_used') return 'source_upload';
  if (eventType === 'session_completed') return 'task_completion';
  if (eventType === 'revision_reviewed') return 'revision_review';
  if (eventType === 'misconception_detected') return 'chat_confusion';
  if (eventType === 'weak_area_detected') return channel === 'practice' ? 'practice_attempt' : 'chat_confusion';
  return channel === 'practice' ? 'practice_attempt' : 'chat_confusion';
}

export async function insertLearningSignal(
  supabase: SupabaseClient,
  context: AgentToolContext,
  input: { signal: LearningSignal; sourceId?: string | null; idempotencyKey?: string }
) {
  const signal = input.signal;
  const idempotencyKey = input.idempotencyKey ?? stableKey([
    'agent-signal',
    context.idempotencyKey,
    signal.type,
    signal.canonicalConcept ?? signal.concept ?? signal.materialId ?? input.sourceId,
  ]);
  const { error } = await supabase
    .from('learning_signals')
    .upsert({
      user_id: context.userId,
      goal_id: context.goalId ?? null,
      signal_type: eventSignalType(signal.type, context.channel),
      source_type: context.channel,
      source_id: uuidOrNull(input.sourceId),
      subject: signal.subject ?? null,
      topic: signal.topic ?? signal.canonicalConcept ?? signal.concept ?? null,
      confidence: signal.confidence,
      evidence: {
        signal,
        runId: context.runId ?? null,
        sourceId: input.sourceId ?? null,
      },
      idempotency_key: idempotencyKey,
    }, {
      onConflict: 'user_id,idempotency_key',
      ignoreDuplicates: true,
    });
  if (error) throw error;
}

export async function findConcept(
  supabase: SupabaseClient,
  input: { userId: string; concept: string; goalId?: string | null }
) {
  const canonical = titleizeConcept(canonicalConceptName({ raw: input.concept }) ?? input.concept);
  let exactQuery = supabase
    .from('concepts')
    .select('*')
    .eq('user_id', input.userId)
    .eq('normalized_name', normalizeConceptText(canonical))
    .limit(1);
  if (input.goalId) exactQuery = exactQuery.eq('goal_id', input.goalId);
  const exact = await exactQuery.maybeSingle();
  if (exact.error) throw exact.error;
  if (exact.data) return exact.data;

  let query = supabase
    .from('concepts')
    .select('*')
    .eq('user_id', input.userId)
    .ilike('name', canonical)
    .limit(1);
  if (input.goalId) query = query.eq('goal_id', input.goalId);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data ?? null;
}

export async function upsertConcept(
  supabase: SupabaseClient,
  input: {
    userId: string;
    concept: string;
    goalId?: string | null;
    subject?: string | null;
    chapter?: string | null;
    topic?: string | null;
  }
) {
  const canonical = titleizeConcept(canonicalConceptName({ raw: input.concept }) ?? input.concept);
  const existing = await findConcept(supabase, {
    userId: input.userId,
    concept: canonical,
    goalId: input.goalId ?? null,
  });
  if (existing?.id) {
    return { conceptId: existing.id as string, created: false, concept: existing };
  }

  const subject = input.subject ?? inferSubjectForConcept(canonical) ?? 'General';
  const chapter = input.chapter ?? inferChapterForConcept(canonical) ?? 'General';
  const topic = input.topic ?? canonical;
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('concepts')
    .insert({
      user_id: input.userId,
      goal_id: input.goalId ?? null,
      name: canonical,
      subject,
      chapter,
      topic,
      mastery: 'not_started',
      mastery_score: 0,
      confidence: 'low',
      created_at: now,
      updated_at: now,
    })
    .select('*')
    .single();
  if (error) throw error;
  return { conceptId: data.id as string, created: true, concept: data };
}

export function signalConcept(signal: LearningSignal) {
  return signal.canonicalConcept ?? signal.concept ?? signal.topic ?? 'General Concept';
}
