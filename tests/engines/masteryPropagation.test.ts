// tests/engines/masteryPropagation.test.ts

import { propagateMastery } from '@/engines/masteryPropagation';
import { LearnerStateService } from '@/services/learnerStateService';
import { getConceptGraph } from '@/graph/knowledgeGraph';

jest.mock('@/services/learnerStateService');
jest.mock('@/graph/knowledgeGraph');

describe('masteryPropagation', () => {
  const mockUpsert = jest.fn();
  const mockServiceInstance = { upsert: mockUpsert };
  (LearnerStateService as jest.Mock).mockImplementation(() => mockServiceInstance);

  const mockGraph = {
    getPrerequisites: jest.fn().mockReturnValue(['conceptA', 'conceptB']),
  };
  (getConceptGraph as jest.Mock).mockResolvedValue(mockGraph);

  beforeEach(() => {
    mockUpsert.mockClear();
    mockGraph.getPrerequisites.mockClear();
  });

  it('updates target concept and its prereqs with decayed boost', async () => {
    await propagateMastery('user-1', 'conceptC', 0.8);
    // target concept update
    expect(mockUpsert).toHaveBeenCalledWith({
      userId: 'user-1',
      conceptId: 'conceptC',
      masteryScore: 0.8,
      lastUpdated: expect.any(Date),
    });
    // prereq updates (2 calls)
    expect(mockUpsert).toHaveBeenCalledTimes(3);
    // first prereq call
    const firstCall = mockUpsert.mock.calls[1][0];
    expect(firstCall.conceptId).toBe('conceptA');
    // second prereq call
    const secondCall = mockUpsert.mock.calls[2][0];
    expect(secondCall.conceptId).toBe('conceptB');
    // ensure decay factor applied (0.1)
    // Since mock DB returns no existing rows, current = 0, updated = min(1, 0 + 0.1 * (0.8 - 0)) = 0.08
    expect(firstCall.masteryScore).toBeCloseTo(0.08);
    expect(secondCall.masteryScore).toBeCloseTo(0.08);
  });
});
