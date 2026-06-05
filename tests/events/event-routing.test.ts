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
    expect(EVENT_CONSUMER_MATRIX.STUDENT_MODEL_SYNC_REQUESTED).toEqual([
      'learning_state_engine',
      'amaura_forgetting_agent',
      'amaura_stagnation_agent',
      'amaura_pattern_memory',
    ]);
  });

  it('routes AUTOPSY_V3_REASONS_COLLECTED to native autopsy and learner-state consumers', () => {
    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_V3_REASONS_COLLECTED).toContain('autopsy_agent');
    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_V3_REASONS_COLLECTED).toContain('learning_state_engine');
  });

  it('routes native Amaura agents without hermes_worker', () => {
    const allRoutes = Object.values(EVENT_CONSUMER_MATRIX).flat();

    expect(allRoutes).not.toContain('hermes_worker');
    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_V3_REPORT_READY).toContain('amaura_autopsy_cascade');
    expect(EVENT_CONSUMER_MATRIX.PRACTICE_ATTEMPT_SUBMITTED).toContain('amaura_practice_agent');
    expect(EVENT_CONSUMER_MATRIX.PRACTICE_ATTEMPT_RECORDED).toContain('amaura_practice_agent');
    expect(EVENT_CONSUMER_MATRIX.STUDY_SESSION_COMPLETED).toContain('amaura_session_agent');
  });
});
