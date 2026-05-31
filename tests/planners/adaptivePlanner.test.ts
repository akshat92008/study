// tests/planners/adaptivePlanner.test.ts

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AdaptivePlanner } from '@/planners/adaptivePlanner';
import { LearnerStateService } from '@/services/learnerStateService';

vi.mock('@/services/learnerStateService');

describe('AdaptivePlanner', () => {
  const mockStates = [
    { userId: 'user-1', conceptId: 'conceptA', masteryScore: 0.9, lastUpdated: new Date() },
    { userId: 'user-1', conceptId: 'conceptB', masteryScore: 0.45, lastUpdated: new Date() },
  ];

  beforeEach(() => {
    vi.mocked(LearnerStateService).mockImplementation(() => ({
      getForUser: vi.fn().mockResolvedValue(mockStates),
    }));
  });

  it('returns a plan with mastery snapshot', async () => {
    const planner = new AdaptivePlanner();
    const plan = await planner.plan('user-1', {});
    expect(plan).toContain('Adaptive plan for user user-1');
    // Mastery snapshot should include concept IDs and percentages.
    expect(plan).toMatch(/conceptA:\d+%/);
    expect(plan).toMatch(/conceptB:\d+%/);
  });
});
