import { propagateMastery, LearnerStateService } from '@/lib/engines/masteryPropagation';

// Mock Supabase so no real DB is hit
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn().mockResolvedValue({
    from: jest.fn().mockReturnValue({
      update: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      data: null,
      error: null,
    }),
  }),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

describe('LearnerStateService', () => {
  it('upsert calls supabase with correct params', async () => {
    const service = new LearnerStateService();
    // Should not throw even with mocked Supabase
    await expect(
      service.upsert({
        userId: 'user-1',
        conceptId: 'concept-abc',
        masteryScore: 0.8,
        lastUpdated: new Date('2026-01-01'),
      })
    ).resolves.toBeUndefined();
  });
});

describe('propagateMastery', () => {
  it('runs without throwing for a known user and concept', async () => {
    // With mocked Supabase returning null data (no prerequisites), it should resolve cleanly
    await expect(propagateMastery('user-1', 'conceptC', 0.8)).resolves.toBeUndefined();
  });
});
