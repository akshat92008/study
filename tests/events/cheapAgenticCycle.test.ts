import { describe, expect, it, vi } from 'vitest';

const executeAgentActions = vi.hoisted(() => vi.fn());

vi.mock('@/lib/agents/action-executor', () => ({
  executeAgentActions,
}));

describe('cheap agentic cycle', () => {
  it('turns a learning event into executable agent actions', async () => {
    executeAgentActions.mockResolvedValue({
      applied: 4,
      proposed: 1,
      skipped: 0,
      failed: 0,
      actions: [],
    });

    const { runCheapAgenticCycle } = await import('@/lib/agents/orchestrator');
    const result = await runCheapAgenticCycle({
      id: '00000000-0000-0000-0000-000000000001',
      userId: '00000000-0000-0000-0000-000000000002',
      type: 'PRACTICE_ATTEMPT_RECORDED',
      payload: {
        items: [{
          subject: 'Physics',
          chapter: 'Kinematics',
          topic: 'Relative motion',
          isCorrect: false,
          timeTakenSeconds: 220,
        }],
      },
    });

    expect(result).toMatchObject({ applied: 4, proposed: 1, skipped: 0, failed: 0 });
    expect(executeAgentActions).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ actionType: 'record_learning_evidence' }),
      expect.objectContaining({ actionType: 'invalidate_session_card' }),
    ]));
  });

  it('skips events without a user id without throwing', async () => {
    const { runCheapAgenticCycle } = await import('@/lib/agents/orchestrator');
    const result = await runCheapAgenticCycle({
      id: '00000000-0000-0000-0000-000000000001',
      userId: '',
      type: 'PRACTICE_ATTEMPT_RECORDED',
      payload: {},
    });

    expect(result).toMatchObject({ skipped: 1, failed: 0 });
  });
});
