import { describe, expect, it } from 'vitest';
import {
  completeAmauraGoalLoopTask,
  createAmauraGoalLoop,
} from '@/lib/amaura/goal-loop';

type Row = Record<string, any>;
type State = Record<string, Row[]>;

class Query {
  private op: 'select' | 'insert' | 'update' = 'select';
  private filters: Array<{ field: string; value: any }> = [];
  private orderings: Array<{ field: string; ascending: boolean }> = [];
  private limitCount: number | null = null;
  private payload: any;

  constructor(
    private readonly state: State,
    private readonly table: string
  ) {}

  select() {
    return this;
  }

  insert(payload: any) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: any) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }

  eq(field: string, value: any) {
    this.filters.push({ field, value });
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

  async single() {
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
        created_at: row.created_at ?? '2026-06-06T00:00:00.000Z',
        updated_at: row.updated_at ?? '2026-06-06T00:00:00.000Z',
        ...row,
      }));
      this.state[this.table].push(...rows);
      return { data: rows, error: null, count: rows.length };
    }

    if (this.op === 'update') {
      const updated: Row[] = [];
      this.state[this.table] = this.state[this.table].map((row) => {
        if (!this.matches(row)) return row;
        const next = { ...row, ...this.payload };
        updated.push(next);
        return next;
      });
      return { data: updated, error: null, count: updated.length };
    }

    let rows = this.state[this.table].filter((row) => this.matches(row));
    for (const ordering of this.orderings.slice().reverse()) {
      rows = rows.sort((a, b) => {
        const av = a[ordering.field];
        const bv = b[ordering.field];
        if (av === bv) return 0;
        return (av > bv ? 1 : -1) * (ordering.ascending ? 1 : -1);
      });
    }
    if (this.limitCount !== null) rows = rows.slice(0, this.limitCount);
    return { data: rows, error: null, count: rows.length };
  }

  private matches(row: Row) {
    return this.filters.every((filter) => row[filter.field] === filter.value);
  }
}

function makeClient(state: State) {
  return {
    from: (table: string) => new Query(state, table),
  };
}

function makeState(): State {
  return {
    learning_goals: [],
    daily_microtasks: [],
    learning_evidence: [],
    session_cards: [],
    amaura_notifications: [],
    amaura_agent_runs: [],
  };
}

describe('Amaura goal loop E2E', () => {
  it('moves one user goal from creation to adapted next action without replay duplicates', async () => {
    const state = makeState();
    const client = makeClient(state);
    const userId = '00000000-0000-0000-0000-000000000123';
    const now = new Date('2026-06-06T04:00:00.000Z');

    const created = await createAmauraGoalLoop({
      client,
      userId,
      title: 'Master Kinematics in 7 days',
      now,
    });

    expect(state.learning_goals).toHaveLength(1);
    expect(created.goal).toMatchObject({
      title: 'Master Kinematics in 7 days',
      subject: 'Physics',
      status: 'active',
    });
    expect(state.daily_microtasks.filter((task) => task.source === 'amaura_goal_decomposer')).toHaveLength(3);
    expect(state.session_cards[0]).toMatchObject({
      goal_id: created.goal.id,
      focusTopic: 'Kinematics',
      taskType: 'concept',
    });
    expect(state.amaura_notifications).toHaveLength(1);

    const firstTask = created.tasks[0];
    const advanced = await completeAmauraGoalLoopTask({
      client,
      userId,
      goalId: created.goal.id,
      taskId: firstTask.id,
      now: new Date('2026-06-06T05:00:00.000Z'),
      outcome: {
        confidence: 'low',
        weakTopic: 'Kinematics graphs',
        score: 0.35,
        notes: 'Graphs still feel shaky.',
      },
    });

    expect(state.daily_microtasks.find((task) => task.id === firstTask.id)).toMatchObject({
      status: 'done',
    });
    expect(state.learning_evidence).toHaveLength(1);
    expect(state.learning_evidence[0]).toMatchObject({
      source_type: 'amaura_task_completion',
      evidence_type: 'weakness',
      topic: 'Kinematics graphs',
    });
    expect(state.learning_goals[0].progress).toBeGreaterThan(0);
    expect(state.learning_goals[0].metadata.amaura_goal_loop).toMatchObject({
      riskLevel: 'medium',
      blockers: ['Kinematics graphs'],
      nextBestAction: {
        title: 'Repair weak spot: Kinematics graphs',
        source: 'amaura_plan_adapter',
      },
    });
    expect(advanced.adaptedTask).toMatchObject({
      source: 'amaura_plan_adapter',
      type: 'weak_concept_repair',
      title: 'Repair weak spot: Kinematics graphs',
    });
    expect(state.session_cards[0]).toMatchObject({
      focusTopic: 'Kinematics graphs',
      taskType: 'weak_concept_repair',
      weakConceptCount: 1,
    });
    expect(state.amaura_notifications.map((row) => row.type)).toEqual([
      'goal_decomposed',
      'plan_adapted',
    ]);
    expect(state.amaura_agent_runs.map((row) => row.agent_name).sort()).toEqual([
      'GoalDecomposerAgent',
      'NextActionAgent',
      'PlanAdapterAgent',
      'ProgressEvaluatorAgent',
    ].sort());
    expect(state.amaura_agent_runs.every((row) => row.status === 'completed')).toBe(true);

    const countsAfterFirstPass = Object.fromEntries(
      Object.entries(state).map(([table, rows]) => [table, rows.length])
    );

    await createAmauraGoalLoop({
      client,
      userId,
      title: 'Master Kinematics in 7 days',
      now,
    });
    await completeAmauraGoalLoopTask({
      client,
      userId,
      goalId: created.goal.id,
      taskId: firstTask.id,
      now: new Date('2026-06-06T05:00:00.000Z'),
      outcome: {
        confidence: 'low',
        weakTopic: 'Kinematics graphs',
        score: 0.35,
      },
    });

    expect(Object.fromEntries(
      Object.entries(state).map(([table, rows]) => [table, rows.length])
    )).toEqual(countsAfterFirstPass);
  });
});
