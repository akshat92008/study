import type { AutopsyReport, HermesLearningMemoryRecord, RepeatedPattern } from './types';

export interface WriteHermesMemoriesInput {
  supabase: any;
  userId: string;
  goalId?: string | null;
  assessmentId?: string | null;
  report: AutopsyReport;
  maxWrites?: number;
}

function normalized(value?: string | null) {
  return (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function sourceRef(assessmentId?: string | null, pattern?: RepeatedPattern) {
  return {
    source_type: 'autopsy_v3_report',
    assessment_id: assessmentId ?? null,
    question_ids: pattern?.sourceQuestionIds ?? [],
    at: new Date().toISOString(),
  };
}

/**
 * Write learning memory candidates to the hermes_learning_memories table.
 * Note: hermes_learning_memories is legacy internal memory storage, not the external Nous Hermes Agent.
 */
export async function writeHermesMemories(input: WriteHermesMemoriesInput): Promise<HermesLearningMemoryRecord[]> {
  const maxWrites = Math.max(0, input.maxWrites ?? 10);
  if (maxWrites === 0) return [];

  const written: HermesLearningMemoryRecord[] = [];
  const candidates = input.report.hermesMemoryCandidates.slice(0, maxWrites);

  for (const candidate of candidates) {
    const patternText = buildPatternText(candidate);
    let query = input.supabase
      .from('hermes_learning_memories')
      .select('*')
      .eq('user_id', input.userId)
      .eq('status', 'active')
      .eq('memory_type', candidate.memoryType);

    if (input.goalId) query = query.eq('goal_id', input.goalId);
    if (candidate.subject) query = query.eq('subject', candidate.subject);
    if (candidate.topic) query = query.eq('topic', candidate.topic);

    const { data: existingRows, error: readError } = await query.limit(10);
    if (readError) throw readError;

    const existing = (existingRows ?? []).find((row: HermesLearningMemoryRecord) =>
      normalized(row.pattern).includes(normalized(candidate.mistakeType).replace(/_/g, ' ')) ||
      normalized(patternText).includes(normalized(row.pattern).slice(0, 48))
    );

    const ref = sourceRef(input.assessmentId, candidate);
    if (existing?.id) {
      const sourceRefs = Array.isArray(existing.source_refs) ? existing.source_refs : [];
      const nextRefs = [...sourceRefs, ref].slice(-20);
      const { data, error } = await input.supabase
        .from('hermes_learning_memories')
        .update({
          evidence_count: (existing.evidence_count ?? 1) + candidate.count,
          severity: strongerSeverity(existing.severity, candidate.severity),
          confidence: Math.max(existing.confidence ?? 0.5, candidate.confidence),
          prevention_rule: candidate.preventionRule,
          last_seen_at: new Date().toISOString(),
          source_refs: nextRefs,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('user_id', input.userId)
        .select('*')
        .single();
      if (error) throw error;
      if (data) written.push(data);
    } else {
      const { data, error } = await input.supabase
        .from('hermes_learning_memories')
        .insert({
          user_id: input.userId,
          goal_id: input.goalId ?? null,
          memory_type: candidate.memoryType,
          subject: candidate.subject,
          topic: candidate.topic,
          pattern: patternText,
          evidence_count: Math.max(1, candidate.count + candidate.priorEvidenceCount),
          severity: candidate.severity,
          confidence: candidate.confidence,
          prevention_rule: candidate.preventionRule,
          next_reminder_condition: reminderConditionFor(candidate),
          source_refs: [ref],
          status: 'active',
        })
        .select('*')
        .single();
      if (error) throw error;
      if (data) written.push(data);
    }
  }

  return written;
}

export async function getRelevantHermesReminders(input: {
  supabase: any;
  userId: string;
  goalId?: string | null;
  subject?: string | null;
  topic?: string | null;
  limit?: number;
}): Promise<HermesLearningMemoryRecord[]> {
  let query = input.supabase
    .from('hermes_learning_memories')
    .select('*')
    .eq('user_id', input.userId)
    .eq('status', 'active')
    .order('last_seen_at', { ascending: false })
    .limit(Math.max(1, input.limit ?? 3));

  if (input.goalId) query = query.eq('goal_id', input.goalId);
  if (input.subject) query = query.eq('subject', input.subject);
  if (input.topic) query = query.eq('topic', input.topic);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

function buildPatternText(pattern: RepeatedPattern) {
  const topic = [pattern.subject, pattern.topic].filter(Boolean).join(' / ') || 'general work';
  return `${pattern.mistakeType.replace(/_/g, ' ')} in ${topic}: ${pattern.rootCause}`;
}

function reminderConditionFor(pattern: RepeatedPattern) {
  if (pattern.topic) return `Before attempting ${pattern.topic} questions`;
  if (pattern.subject) return `Before a ${pattern.subject} practice block`;
  return 'Before the next assessment or worksheet';
}

function strongerSeverity(a?: string, b?: string) {
  const order = ['low', 'medium', 'high', 'critical'];
  return order.indexOf(b ?? 'medium') > order.indexOf(a ?? 'medium') ? b : a;
}
