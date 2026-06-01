import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  getLearnerStateSnapshot: vi.fn(),
}));

vi.mock('@/lib/learner-state/getLearnerState', () => ({
  getLearnerStateSnapshot: state.getLearnerStateSnapshot,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ from: vi.fn(), rpc: vi.fn() })),
}));

vi.mock('@/lib/services/outcome-analytics.service', () => ({
  OutcomeAnalyticsService: class {
    getSummary = vi.fn(async () => null);
  },
}));

vi.mock('@/lib/engines/rag-engine', () => ({
  RAGEngine: class {
    search = vi.fn(async () => []);
  },
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

function learnerState(overrides: Record<string, any> = {}) {
  return {
    profile: {
      userId: 'user-1',
      name: 'Student One',
      examType: 'NEET',
      examDate: null,
      currentLevel: 'intermediate',
      learningStyle: 'visual',
      streakDays: 3,
      timezone: 'Asia/Kolkata',
      mindStateSignal: 'neutral',
      version: 7,
    },
    activeGoal: { title: 'Repair Physics', targetDate: null, progress: 0.4 },
    currentMission: {
      focusTopic: 'Motion',
      subject: 'Physics',
      estimatedMinutes: 30,
      rationale: 'Weak ATLAS concept and due MEMORY card.',
    },
    command: { openTasks: [] },
    recentStudySessions: [],
    atlas: {
      weakConcepts: [
        { name: 'Acceleration', subject: 'Physics', chapter: 'Motion', mastery: 'developing' },
      ],
      masterySummary: { totalConcepts: 10, masteredCount: 4, masteryPercent: 40 },
    },
    memory: {
      dueCount: 1,
      topDueCards: [{ id: 'card-1', front: 'Define acceleration.' }],
    },
    autopsy: {
      recentMistakes: [{ chapter: 'Motion', category: 'conceptual_gap', subject: 'Physics' }],
    },
    recentTopics: ['Motion'],
    studentModel: null,
    lastUpdated: new Date().toISOString(),
    ...overrides,
  };
}

describe('canonical MIND context source', () => {
  beforeEach(() => {
    vi.resetModules();
    state.getLearnerStateSnapshot.mockReset();
  });

  it('includes updated ATLAS mastery and due MEMORY cards from learner state', async () => {
    state.getLearnerStateSnapshot.mockResolvedValue(learnerState());

    const { getMINDContext } = await import('@/lib/engines/mind-engine');
    const ctx = await getMINDContext('user-1', 'help with motion');

    expect(ctx.profile.learnerStateVersion).toBe(7);
    expect(ctx.weakConcepts).toEqual([
      { name: 'Acceleration', subject: 'Physics', chapter: 'Motion', mastery: 'developing' },
    ]);
    expect(ctx.overdueCardsCount).toBe(1);
    expect(ctx.topOverdueCards).toEqual([{ id: 'card-1', front: 'Define acceleration.' }]);
    expect(ctx.currentSessionCard?.focusTopic).toBe('Motion');
  });

  it('binds context lookup to the requested user and does not merge other users', async () => {
    state.getLearnerStateSnapshot.mockResolvedValue(learnerState({
      atlas: {
        weakConcepts: [{ name: 'Only User One', subject: 'Chemistry', chapter: 'Mole', mastery: 'exposed' }],
        masterySummary: { totalConcepts: 1, masteredCount: 0, masteryPercent: 0 },
      },
    }));

    const { getMINDContext } = await import('@/lib/engines/mind-engine');
    const ctx = await getMINDContext('user-1');

    expect(state.getLearnerStateSnapshot).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({ client: expect.anything() })
    );
    expect(JSON.stringify(ctx)).not.toContain('other-user');
    expect(ctx.weakConcepts[0].name).toBe('Only User One');
  });

  it('works when optional learner-state tables are empty', async () => {
    state.getLearnerStateSnapshot.mockResolvedValue(learnerState({
      activeGoal: null,
      currentMission: null,
      command: { openTasks: [] },
      atlas: {
        weakConcepts: [],
        masterySummary: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
      },
      memory: { dueCount: 0, topDueCards: [] },
      autopsy: { recentMistakes: [] },
      recentStudySessions: [],
      recentTopics: [],
    }));

    const { getMINDContext } = await import('@/lib/engines/mind-engine');
    const ctx = await getMINDContext('user-empty');

    expect(ctx.activeGoal).toBeNull();
    expect(ctx.currentSessionCard).toBeNull();
    expect(ctx.weakConcepts).toEqual([]);
    expect(ctx.topOverdueCards).toEqual([]);
    expect(ctx.recentMistakes).toEqual([]);
  });

  it('does not depend on legacy schema field names directly', () => {
    const files = [
      'lib/engines/mind-engine.ts',
      'lib/learner-state/getLearnerState.ts',
      'lib/chat/buildMindContext.ts',
    ];

    const offenders = files.flatMap((file) => {
      const text = fs.readFileSync(path.join(process.cwd(), file), 'utf8');
      const oldTokens = [
        ['mastery', 'level'].join('_'),
        ['due', 'at'].join('_'),
        ['study', 'goals'].join('_'),
      ];
      return oldTokens.filter((token) => text.includes(token)).map((token) => `${file}: ${token}`);
    });

    expect(offenders).toEqual([]);
  });
});
