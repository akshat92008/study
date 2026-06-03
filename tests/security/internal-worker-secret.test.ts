import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/internal/workers/process-events/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';
import * as cronAuth from '@/lib/middleware/cronAuth';
import { EventWorkerService } from '@/lib/events/worker';

vi.mock('@/lib/middleware/cronAuth', () => ({
  validateCronRequest: vi.fn(),
}));

vi.mock('@/lib/events/worker', () => ({
  EventWorkerService: {
    processBatch: vi.fn(),
    getHealthSummary: vi.fn(),
  }
}));

describe('Internal Worker Secret Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects worker execution without valid internal secret', async () => {
    vi.mocked(cronAuth.validateCronRequest).mockReturnValueOnce({
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    } as any);

    const req = createMockRequest('POST', 'http://localhost/api/internal/workers/process-events');
    const response = await POST(req);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
    expect(EventWorkerService.processBatch).not.toHaveBeenCalled();
  });

  it('allows worker execution with valid secret', async () => {
    vi.mocked(cronAuth.validateCronRequest).mockReturnValueOnce(null);
    vi.mocked(EventWorkerService.processBatch).mockResolvedValueOnce({
      processed: 0,
      failed: 0,
      skipped: 0,
      agentActionsApplied: 0,
      agentActionsProposed: 0,
      agentActionsSkipped: 0,
      agentActionsFailed: 0,
    });
    vi.mocked(EventWorkerService.getHealthSummary).mockResolvedValueOnce({
      pendingEvents: 0,
      pendingLocks: 0,
      processingLocks: 0,
      dlqCount: 0,
      oldestPendingAgeSeconds: 0,
      errors: [],
    });

    const req = createMockRequest('POST', 'http://localhost/api/internal/workers/process-events');
    const response = await POST(req);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(true);
    expect(EventWorkerService.processBatch).toHaveBeenCalled();
  });
});
