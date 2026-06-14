import { describe, expect, it } from 'vitest';
import { nextRetryCount, reprocessJobKey, shouldQueueReprocess } from '@/lib/materials/reprocess-state';

describe('material reprocess state', () => {
  it('does not duplicate a processing job unless forced', () => {
    expect(shouldQueueReprocess('processing')).toBe(false);
    expect(shouldQueueReprocess('processing', true)).toBe(true);
  });

  it('increments retries only after a failed processing attempt', () => {
    expect(nextRetryCount('ready', 2)).toBe(2);
    expect(nextRetryCount('queued', 2)).toBe(2);
    expect(nextRetryCount('failed', 2)).toBe(3);
    expect(nextRetryCount('retryable_failed', 2)).toBe(3);
  });

  it('uses one stable ingestion job key for idempotent rebuilds', () => {
    expect(reprocessJobKey('user-1', 'material-1')).toBe('rag_ingestion:user-1:material-1');
  });
});

