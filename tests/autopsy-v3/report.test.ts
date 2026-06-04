import { describe, expect, it } from 'vitest';
import { generateDeterministicAutopsyReport } from '@/lib/autopsy-v3/report-generator';

const assessment = {
  id: 'assessment-1',
  user_id: 'user-1',
  title: 'Unit Test',
  assessment_type: 'custom' as const,
  source: 'manual' as const,
};

const questions = [
  { id: 'q1', assessment_id: 'assessment-1', user_id: 'user-1', question_number: 1, subject: 'Physics', topic: 'Optics', status: 'incorrect' as const, metadata: { totalMarks: 4 } },
  { id: 'q2', assessment_id: 'assessment-1', user_id: 'user-1', question_number: 2, subject: 'Physics', topic: 'Optics', status: 'incorrect' as const, metadata: { totalMarks: 4 } },
  { id: 'q3', assessment_id: 'assessment-1', user_id: 'user-1', question_number: 3, subject: 'Biology', topic: 'Plants', status: 'correct' as const, metadata: { totalMarks: 4 } },
  { id: 'q4', assessment_id: 'assessment-1', user_id: 'user-1', question_number: 4, subject: 'Chemistry', topic: 'Bonds', status: 'skipped' as const, metadata: { totalMarks: 4 } },
];

const diagnoses = [
  { user_id: 'user-1', assessment_id: 'assessment-1', question_id: 'q1', subject: 'Physics', topic: 'Optics', mistake_type: 'misread_question' as const, final_root_cause: 'Missed NOT in the stem', prevention_rule: 'Underline NOT before solving.', severity: 'medium' as const, confidence: 0.8 },
  { user_id: 'user-1', assessment_id: 'assessment-1', question_id: 'q2', subject: 'Physics', topic: 'Optics', mistake_type: 'misread_question' as const, final_root_cause: 'Missed NOT in the stem', prevention_rule: 'Underline NOT before solving.', severity: 'medium' as const, confidence: 0.8 },
];

describe('Autopsy V3 deterministic report', () => {
  it('generates without AI', () => {
    const report = generateDeterministicAutopsyReport({ assessment, questions, diagnoses });
    expect(report.summaryText).toContain('misread question');
  });

  it('includes subject breakdown', () => {
    const report = generateDeterministicAutopsyReport({ assessment, questions, diagnoses });
    expect(report.subjectBreakdown.some((row) => row.subject === 'Physics')).toBe(true);
  });

  it('includes mistake type breakdown', () => {
    const report = generateDeterministicAutopsyReport({ assessment, questions, diagnoses });
    expect(report.mistakeTypeBreakdown[0].mistakeType).toBe('misread_question');
  });

  it('includes recoverable marks', () => {
    const report = generateDeterministicAutopsyReport({ assessment, questions, diagnoses });
    expect(report.recoverableMarks.immediately_recoverable).toBeGreaterThan(0);
  });

  it('includes seven-day protocol', () => {
    const report = generateDeterministicAutopsyReport({ assessment, questions, diagnoses });
    expect(report.sevenDayProtocol).toHaveLength(7);
  });

  it('detects repeated patterns', () => {
    const report = generateDeterministicAutopsyReport({ assessment, questions, diagnoses });
    expect(report.repeatedPatterns[0].count).toBe(2);
  });
});
