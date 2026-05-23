// tests/workers/eventWorker.test.ts

import { EventWorker } from '@/workers/eventWorker';
import { propagateMastery } from '@/engines/masteryPropagation';
import { CognitionEventType } from '@/events/types';

jest.mock('@/engines/masteryPropagation');
jest.mock('@/queues/redisQueue', () => {
  return {
    RedisQueue: class {
      stream: string;
      constructor(stream: string) {
        this.stream = stream;
      }
      async process(handler: (payload: any) => Promise<void>) {
        // Simulate a mastery_changed event
        const payload = {
          type: CognitionEventType.MasteryChanged,
          userId: 'user-123',
          data: { conceptId: 'concept-abc', newScore: 0.85 },
        };
        await handler(payload);
      }
    },
  };
});

describe('EventWorker', () => {
  beforeEach(() => {
    (propagateMastery as jest.Mock).mockClear();
  });

  it('should call propagateMastery for MasteryChanged events', async () => {
    const worker = new EventWorker();
    await worker.start();
    expect(propagateMastery).toHaveBeenCalledWith('user-123', 'concept-abc', 0.85);
  });
});
