import { describe, expect, it, vi } from 'vitest';
import {
  submitDelayedRetest,
  submitImmediateRepair,
  upsertMistakeRisk,
} from '@/lib/services/repair-loop.service';
import { selectSessionCard, type SelectorInput } from '@/lib/engines/session-card-selector';
import { tryRuleFirstResponse } from '@/lib/ai/rule-first-responder';

vi.mock('@/lib/services/session-card-invalidation', () => ({
  invalidateSessionCard: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/engines/mastery-updater', () => ({
  recordMasteryEvidence: vi.fn().mockResolvedValue({ changed: true }),
}));

type Row = Record<string, any>;

function createFakeSupabase(initial: Record<string, Row[]> = {}) {
  const tables: Record<string, Row[]> = {
    mistakes: [],
    revision_cards: [],
    mistake_retests: [],
    concepts: [],
    ...structuredClone(initial),
  };
  let seq = 1;

  class Builder {
    private filters: Array<(row: Row) => boolean> = [];
    private rowsForInsert: Row[] = [];
    private patch: Row = {};
    private mode: 'select' | 'insert' | 'update' | 'delete' = 'select';
    private limitCount: number | null = null;
    private orders: Array<{ column: string; ascending: boolean }> = [];

    constructor(private table: string) {}

    select() { return this; }
    eq(column: string, value: any) {
      this.filters.push((row) => row[column] === value);
      return this;
    }
    in(column: string, values: any[]) {
      this.filters.push((row) => values.includes(row[column]));
      return this;
    }
    lte(column: string, value: any) {
      this.filters.push((row) => String(row[column]) <= String(value));
      return this;
    }
    order(column: string, options: { ascending?: boolean } = {}) {
      this.orders.push({ column, ascending: options.ascending !== false });
      return this;
    }
    limit(count: number) {
      this.limitCount = count;
      return this;
    }
    insert(rowOrRows: Row | Row[]) {
      this.mode = 'insert';
      this.rowsForInsert = Array.isArray(rowOrRows) ? rowOrRows : [rowOrRows];
      return this;
    }
    update(patch: Row) {
      this.mode = 'update';
      this.patch = patch;
      return this;
    }
    delete() {
      this.mode = 'delete';
      return this;
    }
    async maybeSingle() {
      const result = await this.execute();
      return { data: result.data[0] ?? null, error: result.error };
    }
    async single() {
      const result = await this.execute();
      return { data: result.data[0] ?? null, error: result.error };
    }
    then(resolve: any, reject: any) {
      return this.execute().then(resolve, reject);
    }
    private matching() {
      let rows = [...(tables[this.table] ?? [])].filter((row) => this.filters.every((fn) => fn(row)));
      for (const order of [...this.orders].reverse()) {
        rows = rows.sort((a, b) => {
          const dir = order.ascending ? 1 : -1;
          return String(a[order.column] ?? '').localeCompare(String(b[order.column] ?? '')) * dir;
        });
      }
      return this.limitCount === null ? rows : rows.slice(0, this.limitCount);
    }
    private async execute() {
      tables[this.table] ??= [];
      if (this.mode === 'insert') {
        const inserted = this.rowsForInsert.map((row) => ({ id: row.id ?? `${this.table}-${seq++}`, ...row }));
        tables[this.table].push(...inserted);
        return { data: inserted, error: null };
      }
      if (this.mode === 'update') {
        const rows = this.matching();
        for (const row of rows) Object.assign(row, this.patch);
        return { data: rows, error: null };
      }
      if (this.mode === 'delete') {
        const rows = this.matching();
        tables[this.table] = tables[this.table].filter((row) => !rows.includes(row));
        return { data: rows, error: null };
      }
      return { data: this.matching(), error: null, count: this.matching().length };
    }
  }

  return {
    tables,
    from(table: string) {
      return new Builder(table);
    },
  };
}

const selectorBase: SelectorInput = {
  profile: {
    id: 'u1',
    exam_type: 'NEET',
    target_date: null,
    streak_days: 2,
    timezone: 'Asia/Kolkata',
    onboarding_complete: true,
  },
  activeGoal: null,
  overdueCardCount: 0,
  topDueCard: null,
  recentMistakes: [],
  weakConcepts: [],
  sessionCount: 1,
  studentModel: { fatigue_threshold_minutes: 45, peak_productivity_hour: 10 },
  now: '2026-06-07T05:00:00.000Z',
};

describe('repair loop acceptance', () => {
  it('wrong quiz answer creates one canonical mistake, one repair card, and one delayed retest; duplicates merge', async () => {
    const db = createFakeSupabase();

    const first = await upsertMistakeRisk(db, {
      userId: 'u1',
      source: 'quiz',
      subject: 'Biology',
      topic: 'Transport',
      concept: 'Pulmonary artery exception',
      mistakeText: 'Chose vein for pulmonary artery oxygenation.',
      correctAnswer: 'Pulmonary artery carries deoxygenated blood.',
      invalidateSession: false,
    });
    const second = await upsertMistakeRisk(db, {
      userId: 'u1',
      source: 'quiz',
      subject: 'Biology',
      topic: 'Transport',
      concept: 'Pulmonary artery exception',
      mistakeText: 'Chose vein for pulmonary artery oxygenation.',
      correctAnswer: 'Pulmonary artery carries deoxygenated blood.',
      invalidateSession: false,
    });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(db.tables.mistakes).toHaveLength(1);
    expect(db.tables.revision_cards).toHaveLength(1);
    expect(db.tables.mistake_retests).toHaveLength(1);
    expect(db.tables.mistakes[0].status).toBe('open');
  });

  it('immediate repair pass moves mistake to retest_due, delayed pass repairs it, delayed fail reopens it and lowers mastery', async () => {
    const tomorrow = '2026-06-08T05:00:00.000Z';
    const db = createFakeSupabase({
      concepts: [{ id: 'c1', user_id: 'u1', mastery: 'developing', mastery_score: 50 }],
      mistakes: [{
        id: 'm1',
        user_id: 'u1',
        goal_id: null,
        concept_id: 'c1',
        concept: 'Valve backflow questions',
        mistake_text: 'Missed valve direction.',
        status: 'repairing',
        severity: 2,
      }],
      mistake_retests: [{
        id: 'r1',
        user_id: 'u1',
        mistake_id: 'm1',
        due_at: tomorrow,
        question: 'Retest valve direction.',
        status: 'due',
        attempt_count: 0,
      }],
    });

    const immediate = await submitImmediateRepair(db, { userId: 'u1', mistakeId: 'm1', passed: true });
    expect(immediate.status).toBe('retest_due');
    expect(db.tables.mistakes[0].status).toBe('retest_due');

    const passed = await submitDelayedRetest(db, { userId: 'u1', retestId: 'r1', passed: true });
    expect(passed.status).toBe('repaired');
    expect(db.tables.mistakes[0].status).toBe('repaired');

    db.tables.mistakes[0].status = 'retest_due';
    db.tables.mistake_retests.push({
      id: 'r2',
      user_id: 'u1',
      mistake_id: 'm1',
      due_at: tomorrow,
      question: 'Retest valve direction again.',
      status: 'due',
      attempt_count: 0,
    });
    const failed = await submitDelayedRetest(db, { userId: 'u1', retestId: 'r2', passed: false });
    expect(failed.status).toBe('repairing');
    expect(db.tables.mistakes[0].status).toBe('repairing');
    expect(db.tables.concepts[0].mastery_score).toBeLessThan(50);
  });

  it('home selector prioritizes due retest, then open mistake, and never falls back to generic core fundamentals', () => {
    const due = selectSessionCard({
      ...selectorBase,
      overdueCardCount: 12,
      topDueCard: { id: 'card-1', subject: 'Biology', chapter: 'Cell', concept_id: null, difficulty: 5, lapses: 0 },
      dueRetests: [{
        id: 'r1',
        mistake_id: 'm1',
        due_at: '2026-06-07T04:00:00.000Z',
        question: 'What is the pulmonary artery exception?',
        attempt_count: 0,
        mistake: {
          id: 'm1',
          subject: 'Biology',
          topic: 'Circulation',
          chapter: 'Body Fluids',
          concept: 'Pulmonary artery exception',
          concept_id: null,
          mistake_text: 'Chose oxygenated blood.',
        },
      }],
    });
    expect(due.priority).toBe('retest');
    expect(due.topic).toContain('Retest: Pulmonary artery exception');

    const repair = selectSessionCard({
      ...selectorBase,
      overdueCardCount: 4,
      topDueCard: { id: 'card-2', subject: 'Chemistry', chapter: 'GOC', concept_id: null, difficulty: 5, lapses: 0 },
      recentMistakes: [{
        id: 'm2',
        source: 'quiz',
        subject: 'Biology',
        topic: 'Circulation',
        chapter: 'Body Fluids',
        concept: 'Valve backflow questions',
        mistake_text: 'Missed valve direction.',
        category: 'conceptual_gap',
        concept_id: null,
        severity: 4,
        status: 'open',
        created_at: '2026-06-07T03:00:00.000Z',
      }],
    });
    expect(repair.priority).toBe('mistake_repair');
    expect(repair.topic).toContain('Repair: Valve backflow questions');
    expect(repair.topic).not.toContain('Core Fundamentals');
  });

  it('MIND prioritizes due retests before unrelated chat', async () => {
    const result = await tryRuleFirstResponse('u1', 'teach me organic chemistry', {
      dueRetests: [{
        id: 'r1',
        mistake_id: 'm1',
        question: 'Explain the pulmonary artery exception.',
        mistake: { concept: 'Pulmonary artery exception' },
      }],
    });

    expect(result.handled).toBe(true);
    expect(result.response).toContain('Before we continue');
    expect(result.response).toContain('Pulmonary artery exception');
  });
});
