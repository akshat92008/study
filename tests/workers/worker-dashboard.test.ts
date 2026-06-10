import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn((table: string) => ({
      select: vi.fn(() => {
        const mockData = { count: 5, data: [], error: null };
        return {
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(async () => ({ data: { created_at: new Date(Date.now() - 10000).toISOString() } }))
              }))
            })),
            is: vi.fn(async () => mockData),
          })),
          in: vi.fn(async () => mockData),
          is: vi.fn(async () => mockData),
          order: vi.fn(() => ({
            limit: vi.fn(async () => ({ data: [{ retry_count: 2 }, { retry_count: 4 }] }))
          })),
        };
      }),
    })),
  })),
}));

describe('Worker Dashboard (Health Summary)', () => {
  it('correctly aggregates queue health metrics', async () => {
    const { EventWorkerService } = await import('@/lib/events/worker');
    
    const summary = await EventWorkerService.getHealthSummary();
    
    expect(summary).toHaveProperty('pendingEvents');
    expect(summary).toHaveProperty('processingEvents');
    expect(summary).toHaveProperty('failedEvents');
    expect(summary).toHaveProperty('pendingLocks');
    expect(summary).toHaveProperty('processingLocks');
    expect(summary).toHaveProperty('failedLocks');
    expect(summary).toHaveProperty('dlqCount');
    expect(summary).toHaveProperty('oldestPendingAgeSeconds');
    expect(summary).toHaveProperty('averageAttempts');
    
    // Mocked data expectations
    expect(summary.averageAttempts).toBe(3); // (2+4)/2
    expect(summary.oldestPendingAgeSeconds).toBeGreaterThanOrEqual(9);
    expect(summary.oldestPendingAgeSeconds).toBeLessThanOrEqual(11);
  });
});
