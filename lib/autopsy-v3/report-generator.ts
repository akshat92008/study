import { MISTAKE_TYPE_LABELS, SEVERITY_WEIGHT } from './constants';
import { detectRepeatedPatterns } from './pattern-detector';
import { estimateRecoverableMarks, marksLostFor } from './recoverable-marks';
import { scoreQuestions } from './scoring';
import type {
  AssessmentQuestionRecord,
  AssessmentRecord,
  AutopsyReport,
  HermesLearningMemoryRecord,
  MistakeDiagnosisRecord,
  Severity,
} from './types';

export interface GenerateReportInput {
  assessment: AssessmentRecord;
  questions: AssessmentQuestionRecord[];
  diagnoses: MistakeDiagnosisRecord[];
  priorMemories?: HermesLearningMemoryRecord[];
}

export function generateDeterministicAutopsyReport(input: GenerateReportInput): AutopsyReport {
  const { assessment, questions, diagnoses } = input;
  const scored = scoreQuestions(questions);
  const repeatedPatterns = detectRepeatedPatterns(diagnoses, input.priorMemories ?? []);
  const recoverableMarks = estimateRecoverableMarks(assessment, questions, diagnoses);

  const subjectBreakdown = buildSubjectBreakdown(questions);
  const topicBreakdown = buildTopicBreakdown(questions);
  const mistakeTypeBreakdown = buildMistakeTypeBreakdown(diagnoses);
  const highRiskTopics = topicBreakdown
    .map((topic) => ({
      subject: topic.subject,
      topic: topic.topic,
      riskScore: topic.incorrect * 2 + topic.skipped + topic.recoverable,
      reason: `${topic.incorrect} incorrect and ${topic.skipped} skipped in this area.`,
    }))
    .filter((topic) => topic.riskScore > 0)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 5);

  const revisionActions = repeatedPatterns.slice(0, 5).map((pattern) => ({
    title: `${MISTAKE_TYPE_LABELS[pattern.mistakeType]}: ${pattern.topic || pattern.subject || 'General'}`,
    subject: pattern.subject,
    topic: pattern.topic,
    reason: pattern.preventionRule,
  }));

  if (revisionActions.length === 0) {
    for (const topic of highRiskTopics.slice(0, 3)) {
      revisionActions.push({
        title: `Repair ${topic.topic}`,
        subject: topic.subject,
        topic: topic.topic,
        reason: topic.reason,
      });
    }
  }

  const topPattern = repeatedPatterns[0];
  const summaryText = topPattern
    ? `Your biggest pattern is ${MISTAKE_TYPE_LABELS[topPattern.mistakeType].toLowerCase()} in ${topPattern.topic || topPattern.subject || 'general work'}. ${topPattern.preventionRule}`
    : `This report found ${scored.incorrect} incorrect and ${scored.skipped} skipped questions. Start with the highest-risk topic and keep the recovery loop small.`;

  return {
    overview: {
      title: assessment.title,
      totalQuestions: questions.length,
      correct: scored.correct,
      incorrect: scored.incorrect,
      skipped: scored.skipped,
      unknown: scored.unknown,
      score: assessment.scored_marks ?? scored.scoredMarks,
      totalMarks: assessment.total_marks ?? scored.totalMarks,
    },
    subjectBreakdown,
    topicBreakdown,
    mistakeTypeBreakdown,
    repeatedPatterns,
    highRiskTopics,
    recoverableMarks,
    sevenDayProtocol: buildSevenDayProtocol(repeatedPatterns, highRiskTopics),
    revisionActions,
    hermesMemoryCandidates: repeatedPatterns.slice(0, 10),
    summaryText,
  };
}

function buildSubjectBreakdown(questions: AssessmentQuestionRecord[]) {
  const map = new Map<string, { subject: string; total: number; incorrect: number; skipped: number; recoverable: number }>();
  for (const question of questions) {
    const subject = question.subject || 'General';
    const row = map.get(subject) ?? { subject, total: 0, incorrect: 0, skipped: 0, recoverable: 0 };
    row.total += 1;
    if (question.status === 'incorrect') {
      row.incorrect += 1;
      row.recoverable += marksLostFor(question);
    }
    if (question.status === 'skipped' || question.status === 'unattempted') row.skipped += 1;
    map.set(subject, row);
  }
  return Array.from(map.values()).sort((a, b) => b.incorrect + b.skipped - (a.incorrect + a.skipped));
}

function buildTopicBreakdown(questions: AssessmentQuestionRecord[]) {
  const map = new Map<string, { topic: string; subject: string | null; total: number; incorrect: number; skipped: number; recoverable: number }>();
  for (const question of questions) {
    const topic = question.topic || question.subtopic || 'General';
    const key = `${question.subject ?? ''}:${topic}`;
    const row = map.get(key) ?? { topic, subject: question.subject ?? null, total: 0, incorrect: 0, skipped: 0, recoverable: 0 };
    row.total += 1;
    if (question.status === 'incorrect') {
      row.incorrect += 1;
      row.recoverable += marksLostFor(question);
    }
    if (question.status === 'skipped' || question.status === 'unattempted') row.skipped += 1;
    map.set(key, row);
  }
  return Array.from(map.values()).sort((a, b) => b.incorrect + b.skipped - (a.incorrect + a.skipped));
}

function buildMistakeTypeBreakdown(diagnoses: MistakeDiagnosisRecord[]) {
  const map = new Map<string, { mistakeType: any; count: number; severity: Severity }>();
  for (const diagnosis of diagnoses) {
    const row = map.get(diagnosis.mistake_type) ?? {
      mistakeType: diagnosis.mistake_type,
      count: 0,
      severity: 'low' as Severity,
    };
    row.count += 1;
    if (SEVERITY_WEIGHT[diagnosis.severity ?? 'medium'] > SEVERITY_WEIGHT[row.severity]) {
      row.severity = diagnosis.severity ?? 'medium';
    }
    map.set(diagnosis.mistake_type, row);
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}

function buildSevenDayProtocol(
  patterns: AutopsyReport['repeatedPatterns'],
  topics: AutopsyReport['highRiskTopics']
) {
  const topTarget = patterns[0]?.topic || topics[0]?.topic || 'the top weak area';
  return [
    { day: 1, title: 'Replay the misses', action: `Redo every wrong or skipped question from ${topTarget} without looking at the solution.` },
    { day: 2, title: 'Patch the rule', action: 'Write the rule, formula, or reading trap behind each miss in one line.' },
    { day: 3, title: 'Drill variants', action: `Solve 10 easier-to-medium questions around ${topTarget}.` },
    { day: 4, title: 'Timed repair', action: 'Run a short timed set and apply the prevention rule before marking answers.' },
    { day: 5, title: 'Recall check', action: 'Review only the cards or notes connected to the repeated pattern.' },
    { day: 6, title: 'Mixed practice', action: 'Mix the repaired topic with two unrelated topics to test transfer.' },
    { day: 7, title: 'Mini autopsy', action: 'Review the new mistakes and archive patterns that improved.' },
  ];
}
