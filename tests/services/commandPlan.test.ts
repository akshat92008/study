import { describe, expect, it } from 'vitest';
import { ensureCommandPlanForDate } from '@/lib/services/command-plan.service';

type Row = Record<string, any>;

function isoNow() {
  return new Date().toISOString();
}

class Query {
  private op: 'select' | 'insert' | 'upsert' = 'select';
  private filters: Array<{ field: string; op: string; value: any }> = [];
  private orderings: Array<{ field: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private countMode = false;
  private payload: any;

  constructor(private readonly state: Record<string, Row[]>, private readonly table: string) {}

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
        created_at: row.created_at ?? isoNow(),
        updated_at: row.updated_at ?? isoNow(),
        ...row,
      }));
      this.state[this.table].push(...rows);
      return { data: rows, error: null, count: rows.length };
    }

    if (this.op === 'upsert') {
      const row = {
        id: this.payload.id ?? `${this.table}-${this.state[this.table].length + 1}`,
        created_at: this.payload.created_at ?? isoNow(),
        ...this.payload,
      };
      const index = this.state[this.table].findIndex((existing) =>
        existing.user_id === row.user_id &&
        (existing.plan_date === row.plan_date || existing.usage_date === row.usage_date)
      );
      if (index >= 0) this.state[this.table][index] = { ...this.state[this.table][index], ...row };
      else this.state[this.table].push(row);
      return { data: [row], error: null, count: 1 };
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

function makeClient(state: Record<string, Row[]>) {
  return {
    from: (table: string) => new Query(state, table),
  };
}

function makeState() {
  return {
    profiles: [{
      id: 'user-1',
      exam_type: 'NEET',
      target_date: '2026-05-03',
      target_score: 650,
      daily_hours_available: 4,
      emotional_state: 'neutral',
    }],
    revision_cards: [{
      id: 'card-1',
      user_id: 'user-1',
      front: 'Electrochemistry Nernst equation',
      subject: 'Chemistry',
      chapter: 'Electrochemistry',
      due: '2020-01-01T00:00:00.000Z',
      state: 0,
      difficulty: 6,
      lapses: 1,
    }],
    concepts: [{
      id: 'concept-1',
      user_id: 'user-1',
      name: 'Plant Physiology Transport',
      subject: 'Biology',
      chapter: 'Plant Physiology',
      mastery: 'exposed',
      forgetting_probability: 0.9,
    }],
    mistakes: [{
      id: 'mistake-1',
      user_id: 'user-1',
      subject: 'Chemistry',
      chapter: 'Electrochemistry',
      category: 'conceptual_gap',
      marks_lost: 5,
      created_at: isoNow(),
    }],
    episodic_memories: [{
      id: 'episode-1',
      user_id: 'user-1',
      summary: 'Student confused oxidation potential with reduction potential.',
      retrieval_weight: 5,
      created_at: isoNow(),
    }],
    mock_autopsies: [],
    revision_logs: [],
    study_sessions: [],
    chat_sessions: [],
    daily_plans: [],
    study_tasks: [],
  };
}

describe('COMMAND plan service', () => {
  it('creates an idempotent daily plan grounded in memory, ATLAS, AUTOPSY, and MEMORY', async () => {
    const state = makeState();
    const client = makeClient(state);

    const first = await ensureCommandPlanForDate({
      userId: 'user-1',
      date: '2026-06-01',
      client,
    });

    expect(first.created).toBe(true);
    expect(first.tasks.map((task) => task.type)).toEqual(expect.arrayContaining(['revision', 'practice', 'study']));
    expect(first.briefing).toContain('Last time: Student confused oxidation potential');
    expect(state.daily_plans).toHaveLength(1);
    expect(state.study_tasks).toHaveLength(first.tasks.length);

    const second = await ensureCommandPlanForDate({
      userId: 'user-1',
      date: '2026-06-01',
      client,
    });

    expect(second.created).toBe(false);
    expect(state.study_tasks).toHaveLength(first.tasks.length);
    expect(state.daily_plans).toHaveLength(1);
  });

  it('does not invent a memory callback when no episode exists', async () => {
    const state = makeState();
    state.episodic_memories = [];

    const result = await ensureCommandPlanForDate({
      userId: 'user-1',
      date: '2026-06-01',
      client: makeClient(state),
    });

    expect(result.briefing).not.toContain('Last time:');
    expect(result.briefing).toContain('Today');
  });
});
