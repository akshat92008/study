import { describe, expect, it } from 'vitest';
import { classifyHermesIntent } from '@/lib/hermes/ui/intent';
import { planHermesAction } from '@/lib/hermes/ui/planner';
import type { HermesUserState } from '@/lib/hermes/ui/types';

function state(overrides: Partial<HermesUserState> = {}): HermesUserState {
  return {
    userId: 'u1',
    activeGoal: { id: 'g1', title: 'Master Physics Class 12' },
    counts: {
      sourcesReady: 0,
      sourcesProcessing: 0,
      sourcesFailed: 0,
      dueCards: 3,
      weakConcepts: 2,
      recentMistakes: 1,
      pendingMicrotasks: 1,
    },
    todayTasks: [{ id: 't1', title: 'Revise vectors', estimatedMinutes: 20 }],
    sourceStatuses: [],
    warnings: [],
    ...overrides,
  };
}

describe('Hermes Lite planner', () => {
  it('returns existing mission with no LLM', () => {
    const plan = planHermesAction(classifyHermesIntent('What should I do now?'), state(), 'What should I do now?');
    expect(plan.tools).toHaveLength(0);
    expect(plan.usedLLM).toBe(false);
    expect(plan.costMode).toBe('lite');
    expect(plan.cards[0].type).toBe('mission');
  });

  it('returns source status with no LLM', () => {
    const plan = planHermesAction(classifyHermesIntent('Show source status'), state(), 'Show source status');
    expect(plan.usedLLM).toBe(false);
    expect(plan.tools).toHaveLength(0);
    expect(plan.cards[0].type).toBe('source_status');
  });

  it('allows Heavy for explanations', () => {
    const plan = planHermesAction(classifyHermesIntent('Explain Raoult law'), state(), 'Explain Raoult law');
    expect(plan.costMode).toBe('heavy');
    expect(plan.tools[0].name).toBe('askTutorWithContext');
  });

  it('asks for a goal when mission is requested without one', () => {
    const plan = planHermesAction(
      classifyHermesIntent('What should I do now?'),
      state({ activeGoal: null, todayTasks: [] }),
      'What should I do now?'
    );
    expect(plan.cards[0].type).toBe('clarification');
  });
});
