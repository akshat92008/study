import type {
  HermesLearningMemoryRecord,
  MemoryType,
  MistakeDiagnosisRecord,
  MistakeType,
  RepeatedPattern,
  Severity,
} from './types';

function normalizeKey(value?: string | null): string {
  return (value ?? 'general')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim() || 'general';
}

function severityFromCount(count: number, priorEvidenceCount: number): Severity {
  const total = count + priorEvidenceCount;
  if (total >= 8) return 'critical';
  if (total >= 4) return 'high';
  if (total >= 2) return 'medium';
  return 'low';
}

function memoryTypeFor(mistakeType: MistakeType): MemoryType {
  if (mistakeType === 'time_pressure') return 'time_pressure_pattern';
  if (['silly_error', 'misread_question', 'overthinking', 'poor_elimination'].includes(mistakeType)) {
    return 'behavior_pattern';
  }
  if (mistakeType === 'memory_gap' || mistakeType === 'lack_of_revision') return 'weak_topic';
  return 'mistake_pattern';
}

export function detectRepeatedPatterns(
  diagnoses: MistakeDiagnosisRecord[],
  priorMemories: HermesLearningMemoryRecord[] = []
): RepeatedPattern[] {
  const groups = new Map<string, MistakeDiagnosisRecord[]>();

  for (const diagnosis of diagnoses) {
    if (diagnosis.mistake_type === 'unknown' && !diagnosis.topic && !diagnosis.subject) continue;
    const subject = normalizeKey(diagnosis.subject);
    const topic = normalizeKey(diagnosis.topic);
    const root = normalizeKey(diagnosis.final_root_cause ?? diagnosis.user_reason ?? diagnosis.mistake_type);
    const key = `${subject}:${topic}:${diagnosis.mistake_type}:${root.slice(0, 48)}`;
    groups.set(key, [...(groups.get(key) ?? []), diagnosis]);
  }

  const patterns: RepeatedPattern[] = [];

  for (const [key, items] of groups.entries()) {
    const first = items[0];
    const priorEvidenceCount = priorMemories
      .filter((memory) =>
        normalizeKey(memory.subject) === normalizeKey(first.subject) &&
        normalizeKey(memory.topic) === normalizeKey(first.topic) &&
        normalizeKey(memory.pattern).includes(normalizeKey(first.mistake_type).replace(/_/g, ' '))
      )
      .reduce((sum, memory) => sum + (memory.evidence_count ?? 0), 0);

    if (items.length + priorEvidenceCount < 2 && first.mistake_type !== 'concept_gap') continue;

    const severity = severityFromCount(items.length, priorEvidenceCount);
    const confidence = Math.min(0.95, 0.52 + items.length * 0.12 + priorEvidenceCount * 0.04);
    const rootCause = first.final_root_cause || first.user_reason || `${first.mistake_type} pattern`;

    patterns.push({
      key,
      subject: first.subject ?? null,
      topic: first.topic ?? null,
      mistakeType: first.mistake_type,
      rootCause,
      count: items.length,
      priorEvidenceCount,
      severity,
      confidence,
      preventionRule: first.prevention_rule || 'Slow down, name the trap, and retry one similar question.',
      memoryType: memoryTypeFor(first.mistake_type),
      sourceQuestionIds: items.map((item) => item.question_id).filter(Boolean) as string[],
    });
  }

  return patterns.sort((a, b) => {
    const scoreA = a.count + a.priorEvidenceCount + severityScore(a.severity);
    const scoreB = b.count + b.priorEvidenceCount + severityScore(b.severity);
    return scoreB - scoreA;
  });
}

function severityScore(severity: Severity): number {
  if (severity === 'critical') return 4;
  if (severity === 'high') return 3;
  if (severity === 'medium') return 2;
  return 1;
}
