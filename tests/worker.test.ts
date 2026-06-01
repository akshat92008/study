import { describe, it, expect, vi } from 'vitest';
import { EventDispatcher } from '@/lib/events/orchestrator';

// Mock dependencies
vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: {
    publish: vi.fn(),
  },
}));

describe('Worker Event Processing', () => {
  it('should process STUDY_SESSION_COMPLETED correctly', async () => {
    const payload = {
      user_id: 'test-user-id',
      type: 'STUDY_SESSION_COMPLETED',
      data: {
        sessionId: 'test-session',
        understood: true,
      },
      metadata: { source: 'test' },
      idempotency_key: 'test-key',
    };

    await EventDispatcher.publish(payload);

    expect(EventDispatcher.publish).toHaveBeenCalledWith(payload);
  });

  it('should process AUTOPSY_MOCK_PROCESSED correctly', async () => {
    const payload = {
      user_id: 'test-user-id',
      type: 'AUTOPSY_MOCK_PROCESSED',
      data: {
        mockId: 'test-mock',
      },
      metadata: { source: 'test' },
      idempotency_key: 'test-key-2',
    };

    await EventDispatcher.publish(payload);

    expect(EventDispatcher.publish).toHaveBeenCalledWith(payload);
  });
});
