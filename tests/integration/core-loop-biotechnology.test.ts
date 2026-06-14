import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { normalizeGoal } from '@/lib/goals/normalize-goal';
import { selectSeedTemplate } from '@/lib/topic-seeding/template-registry';
import { evaluateAnswer, persistAnswerEvaluation } from '@/lib/tutor/evaluate-answer';
import { getAllQuestionsForChapter, getNextQuestion } from '@/lib/tutor/question-engine';
import { classifyFailureCause, getDegradationMessage } from '@/lib/ai/degradation-messages';

class FakeBuilder {
  private operation = '';
  private payload: any;
  constructor(private db: FakeSupabase, private table: string) {}
  insert(payload: any) { this.operation = 'insert'; this.payload = payload; this.db.writes.push({ table: this.table, operation: this.operation, payload }); return this; }
  upsert(payload: any) { this.operation = 'upsert'; this.payload = payload; this.db.writes.push({ table: this.table, operation: this.operation, payload }); return this; }
  update(payload: any) { this.operation = 'update'; this.payload = payload; this.db.writes.push({ table: this.table, operation: this.operation, payload }); return this; }
  select() { return this; }
  eq() { return this; }
  is() { return this; }
  order() { return this; }
  limit() { return this; }
  single() { return Promise.resolve({ data: this.table === 'tutor_question_attempts' ? { id: 'attempt-1' } : null, error: null }); }
  maybeSingle() { return Promise.resolve({ data: this.db.existing[this.table] ?? null, error: null }); }
  then(resolve: (value: any) => unknown, reject?: (reason: any) => unknown) {
    return Promise.resolve({ data: null, error: null }).then(resolve, reject);
  }
}

class FakeSupabase {
  writes: Array<{ table: string; operation: string; payload: any }> = [];
  existing: Record<string, any> = {};
  from(table: string) { return new FakeBuilder(this, table); }
}

describe('core loop: biotechnology', () => {
  it('normalizes and seeds the exact NEET Biotechnology mission', () => {
    const normalized = normalizeGoal('master biotechnology');
    expect(normalized).toMatchObject({
      exam: 'NEET',
      subject: 'Biology',
      classLevel: '12',
      chapter: 'Biotechnology and Its Applications',
      chapterSlug: 'neet-biology-biotechnology',
      mode: 'mastery',
    });

    for (const input of ['revise biotech for neet', 'PCR and rDNA']) {
      expect(normalizeGoal(input).chapterSlug).toBe('neet-biology-biotechnology');
    }

    const selected = selectSeedTemplate({
      userId: 'user-1', goalId: 'goal-1', goalTitle: 'master biotechnology',
      exam: 'neet', subject: 'biology', chapter: 'Biotechnology',
    });
    expect(selected.templateKey).toBe('neet-biology-biotechnology');

    const missionText = selected.template.missions
      .flatMap((mission) => [mission.title, mission.description, ...(mission.microtargets ?? []).map((item) => item.title)])
      .join(' ')
      .toLowerCase();
    for (const required of ['biotechnology', 'recombinant dna']) {
      expect(missionText).toContain(required);
    }
    for (const generic of ['core fundamentals', 'key definitions', 'worked examples', 'practice questions']) {
      expect(missionText).not.toContain(generic);
    }
    for (const microtarget of selected.template.missions.flatMap((mission) => mission.microtargets ?? [])) {
      expect(microtarget.conceptTags.length).toBeGreaterThan(0);
      expect(microtarget.activeRecallQuestions.length).toBeGreaterThan(0);
      expect(microtarget.commonTraps.length).toBeGreaterThan(0);
      expect(microtarget.masteryCriteria.length).toBeGreaterThan(0);
      expect(microtarget.estimatedMinutes).toBeGreaterThan(0);
    }
  });

  it('evaluates a partial ori answer, stores learning evidence, and adapts the next question', async () => {
    const ori = getAllQuestionsForChapter('neet-biology-biotechnology').find((item) => item.questionId === 'biotechnology-q-0-0-0')!;
    const evaluation = evaluateAnswer({
      question: ori.question,
      expectedAnswerPoints: ori.expectedAnswerPoints,
      userAnswer: 'It relates to the core principle of biotechnology.',
      conceptTags: ori.conceptTags,
      chapterSlug: 'neet-biology-biotechnology',
      goalId: 'goal-1',
    });
    expect(evaluation.score).toBe('partial');
    expect(evaluation.matchedPoints.length).toBeGreaterThan(0);

    const supabase = new FakeSupabase();
    await persistAnswerEvaluation({
      supabase,
      userId: 'user-1',
      goalId: 'goal-1',
      chapterSlug: 'neet-biology-biotechnology',
      question: ori,
      userAnswer: 'It starts replication.',
      evaluation,
    });

    expect(supabase.writes.some((write) => write.table === 'tutor_question_attempts' && write.payload.score === 'partial')).toBe(true);
    expect(supabase.writes.some((write) => write.table === 'learning_events')).toBe(true);
    expect(supabase.writes.some((write) => write.table === 'concept_mastery' && write.payload.concept_tag === 'biotechnology')).toBe(true);
    expect(supabase.writes.some((write) => write.table === 'weak_area_events' && write.payload.concept_tag === 'biotechnology')).toBe(true);

    const next = getNextQuestion({
      chapterSlug: 'neet-biology-biotechnology',
      weakAreas: [{ concept_tag: 'biotechnology', severity: 'active' }],
      recentQuestions: [ori.questionId],
    });
    expect(next?.questionId).not.toBe(ori.questionId);
    expect(next?.conceptTags.some((tag) => ['biotechnology', 'recombinant_dna'].includes(tag))).toBe(true);
  });

  it('continues in offline mode and keeps failed provider calls uncommitted', () => {
    expect(classifyFailureCause(Object.assign(new Error('provider overloaded'), { statusCode: 503 }))).toBe('provider_overloaded');
    expect(getDegradationMessage('provider_overloaded')).toContain('offline tutor mode');

    const budgetedSource = fs.readFileSync(path.join(process.cwd(), 'lib/ai/budgeted.ts'), 'utf8');
    const costGuardSource = fs.readFileSync(path.join(process.cwd(), 'lib/ai/cost-guard.ts'), 'utf8');
    expect(budgetedSource).toContain("releaseBudgetReservation(reservation.reservationId, 'degraded_response')");
    expect(budgetedSource).toContain("fullResponseBuffer.includes('offline tutor mode')");
    expect(costGuardSource).not.toContain('if (true || shouldBypassNetworkBudgetForTests()');
  });
});
