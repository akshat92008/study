import { describe, expect, it } from 'vitest';
import {
  ensureCommandPlanForDate,
  formatCommandPlanForChat,
  formatRevisionQueueForChat,
  formatWeakAreasForChat,
} from '@/lib/services/command-plan.service';

type Row = Record<string, any>;

class Query {
  private op: 'select' | 'insert' | 'upsert' = 'select';
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private orderings: Array<{ field: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private countMode = false;
  private payload: any;

  constructor(private state: Record<string, Row[]>, private table: string) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }) {
    this.countMode = Boolean(options?.count);
    return this;
  }

  insert(payload: any) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  upsert(payload: any) {
    this.op = 'upsert';
    this.payload = payload;
    return this.execute();
  }

  eq(field: string, value: any) {
    this.filters.push({ field, op: 'eq', value });
    return this;
  }

  neq(field: string, value: any) {
    this.filters.push({ field, op: 'neq', value });
    return this;
  }

  in(field: string, value: any[]) {
    this.filters.push({ field, op: 'in', value });
    return this;
  }

  lte(field: string, value: any) {
    this.filters.push({ field, op: 'lte', value });
    return this;
  }

  gte(field: string, value: any) {
    this.filters.push({ field, op: 'gte', value });
    return this;
  }

  order(field: string, options: { ascending?: boolean } = {}) {
    this.orderings.push({ field, ascending: options.ascending !== false });
    return this;
  }

  limit(value: number) {
    this.limitCount = value;
    return this;
  }

  async maybeSingle() {
    const result = await this.execute();
    return { ...result, data: Array.isArray(result.data) ? result.data[0] ?? null : result.data };
  }

  then(resolve: any, reject?: any) {
    return this.execute().then(resolve, reject);
  }

  private async execute() {
    this.state[this.table] ||= [];
    if (this.op === 'insert') {
      const rows = (Array.isArray(this.payload) ? this.payload : [this.payload]).map((row) => ({
        id: row.id ?? `${this.table}-${this.state[this.table].length + 1}`,
        created_at: row.created_at ?? new Date().toISOString(),
        ...row,
      }));
      this.state[this.table].push(...rows);
      return { data: rows, error: null, count: rows.length };
    }
    if (this.op === 'upsert') {
      const idx = this.state[this.table].findIndex((row) =>
        row.user_id === this.payload.user_id &&
        row.plan_date === this.payload.plan_date
      );
      if (idx >= 0) this.state[this.table][idx] = { ...this.state[this.table][idx], ...this.payload };
      else this.state[this.table].push({ id: `${this.table}-${this.state[this.table].length + 1}`, ...this.payload });
      return { data: [this.payload], error: null, count: 1 };
    }

    let rows = this.state[this.table].filter((row) => this.filters.every((filter) => {
      const actual = row[filter.field.replaceAll('"', '')];
      if (filter.op === 'eq') return actual === filter.value;
      if (filter.op === 'neq') return actual !== filter.value;
      if (filter.op === 'in') return filter.value.includes(actual);
      if (filter.op === 'lte') return String(actual) <= String(filter.value);
      if (filter.op === 'gte') return String(actual) >= String(filter.value);
      return true;
    }));

    for (const ordering of this.orderings.slice().reverse()) {
      rows = rows.sort((a, b) => {
        const av = a[ordering.field];
        const bv = b[ordering.field];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (ordering.ascending ? 1 : -1);
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return { data: rows, error: null, count: this.countMode ? rows.length : null };
  }
}

function client(state: Record<string, Row[]>) {
  return { from: (table: string) => new Query(state, table) };
}

describe('private beta chat-first loop contract', () => {
  it('grounds COMMAND, ATLAS, MEMORY, tutor memory, and analytics in DB state', async () => {
    const state = {
      profiles: [{
        id: 'student-1',
        exam_type: 'NEET',
        target_score: 650,
        target_date: '2026-05-03',
        daily_hours_available: 4,
        subjects: ['Physics', 'Chemistry', 'Biology'],
        current_level: 'intermediate',
      }],
      concepts: [
        { id: 'concept-electro', user_id: 'student-1', name: 'Nernst Equation', subject: 'Chemistry', chapter: 'Electrochemistry', mastery: 'exposed', forgetting_probability: 0.95 },
        { id: 'concept-plant', user_id: 'student-1', name: 'Transport in Plants', subject: 'Biology', chapter: 'Plant Physiology', mastery: 'not_started', forgetting_probability: 0.9 },
      ],
      revision_cards: [{
        id: 'card-1',
        user_id: 'student-1',
        front: 'Explain why Nernst equation changes with concentration.',
        subject: 'Chemistry',
        chapter: 'Electrochemistry',
        due: '2020-01-01T00:00:00.000Z',
        state: 0,
      }],
      mistakes: [{
        id: 'mistake-1',
        user_id: 'student-1',
        subject: 'Chemistry',
        chapter: 'Electrochemistry',
        category: 'conceptual_gap',
        marks_lost: 5,
        created_at: new Date().toISOString(),
      }],
      episodic_memories: [{
        id: 'episode-1',
        user_id: 'student-1',
        summary: 'Tutor session showed the student mixed electrochemical cell sign conventions.',
        retrieval_weight: 7,
      }],
      mock_autopsies: [
        { id: 'mock-1', user_id: 'student-1', current_score: 420, recoverable_marks: 35, created_at: '2026-05-20T00:00:00.000Z' },
        { id: 'mock-0', user_id: 'student-1', current_score: 400, recoverable_marks: 45, created_at: '2026-05-01T00:00:00.000Z' },
      ],
      revision_logs: [],
      study_sessions: [],
      chat_sessions: [],
      daily_plans: [],
      study_tasks: [],
    };

    const plan = await ensureCommandPlanForDate({
      userId: 'student-1',
      date: '2026-06-01',
      client: client(state),
    });
    const commandAnswer = formatCommandPlanForChat(plan);
    const atlasAnswer = formatWeakAreasForChat({
      weakConcepts: state.concepts,
      recentMistakes: state.mistakes,
      masteryPercent: 0,
    });
    const memoryAnswer = formatRevisionQueueForChat({
      dueCount: state.revision_cards.length,
      cards: state.revision_cards,
    });

    expect(state.study_tasks.length).toBeGreaterThan(0);
    expect(state.daily_plans).toHaveLength(1);
    expect(commandAnswer).toContain('Plan for 2026-06-01');
    expect(commandAnswer).toContain('Electrochemistry');
    expect(commandAnswer).toContain('Last time: Tutor session showed');
    expect(atlasAnswer).toContain('Plant Physiology');
    expect(memoryAnswer).toContain('Nernst equation');
  });
});
