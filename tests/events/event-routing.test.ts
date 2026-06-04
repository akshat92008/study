import { describe, it, expect } from 'vitest';
import { EVENT_CONSUMER_MATRIX, EVENT_CONSUMERS } from '../../lib/events/routes';

describe('Event Routing Matrix', () => {
  it('does not contain stale command_engine', () => {
    // Should not be in consumers list
    expect(EVENT_CONSUMERS as readonly string[]).not.toContain('command_engine');

    // Should not be in any route
    const allRoutes = Object.values(EVENT_CONSUMER_MATRIX).flat();
    expect(allRoutes).not.toContain('command_engine');
  });

  it('routes STUDENT_MODEL_SYNC_REQUESTED only to valid consumers', () => {
    expect(EVENT_CONSUMER_MATRIX.STUDENT_MODEL_SYNC_REQUESTED).toEqual(['learning_state_engine']);
  });

  it('routes AUTOPSY_V3_REASONS_COLLECTED to autopsy_agent, hermes_worker, learning_state_engine', () => {
    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_V3_REASONS_COLLECTED).toContain('autopsy_agent');
    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_V3_REASONS_COLLECTED).toContain('hermes_worker');
    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_V3_REASONS_COLLECTED).toContain('learning_state_engine');
  });
});
