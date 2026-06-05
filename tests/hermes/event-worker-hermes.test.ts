import { describe, expect, it } from 'vitest';
import { EVENT_CONSUMER_MATRIX, EVENT_CONSUMERS } from '@/lib/events/routes';

describe('Hermes event worker retirement', () => {
  it('does not register hermes_worker as a queue consumer', () => {
    expect(EVENT_CONSUMERS as readonly string[]).not.toContain('hermes_worker');

    const allRoutes = Object.values(EVENT_CONSUMER_MATRIX).flat();
    expect(allRoutes).not.toContain('hermes_worker');
  });

  it('does not route legacy HERMES_* events through the active TypeScript matrix', () => {
    const matrix = EVENT_CONSUMER_MATRIX as Record<string, readonly string[] | undefined>;

    expect(matrix.HERMES_MISTAKE_REVIEW_REQUESTED).toBeUndefined();
    expect(matrix.HERMES_SOURCE_PROCESS_REQUESTED).toBeUndefined();
    expect(matrix.HERMES_REVISION_QUALITY_REQUESTED).toBeUndefined();
    expect(matrix.HERMES_TRACE_REQUESTED).toBeUndefined();
    expect(matrix.HERMES_NEXT_ACTION_REQUESTED).toBeUndefined();
    expect(matrix.HERMES_MEMORY_UPDATED).toBeUndefined();
  });
});
