export const AMAURA_EVENTS = {
  AMAURA_GOAL_CREATED: 'AMAURA_GOAL_CREATED',
  AMAURA_GOAL_UPDATED: 'AMAURA_GOAL_UPDATED',
  AMAURA_TASK_CREATED: 'AMAURA_TASK_CREATED',
  AMAURA_TASK_COMPLETED: 'AMAURA_TASK_COMPLETED',
  AMAURA_TASK_SKIPPED: 'AMAURA_TASK_SKIPPED',
  AMAURA_OBSERVATION_RECORDED: 'AMAURA_OBSERVATION_RECORDED',
  AMAURA_PLAN_ADAPTED: 'AMAURA_PLAN_ADAPTED',
  AMAURA_GOAL_PROGRESS_EVALUATED: 'AMAURA_GOAL_PROGRESS_EVALUATED',
  AMAURA_NEXT_ACTION_UPDATED: 'AMAURA_NEXT_ACTION_UPDATED',
  AUTOPSY_V3_REPORT_READY: 'AUTOPSY_V3_REPORT_READY',
  MEMORY_REVIEW_COMPLETED: 'MEMORY_REVIEW_COMPLETED',
  ATLAS_CONCEPT_UPDATED: 'ATLAS_CONCEPT_UPDATED',
  SESSION_CLOSED: 'SESSION_CLOSED',
  DAILY_AGENT_TICK: 'DAILY_AGENT_TICK',
} as const;

export const AMAURA_LEGACY_EVENTS = {
  PRACTICE_ATTEMPT_SUBMITTED: 'PRACTICE_ATTEMPT_SUBMITTED',
  PRACTICE_ATTEMPT_RECORDED: 'PRACTICE_ATTEMPT_RECORDED',
  STUDY_SESSION_COMPLETED: 'STUDY_SESSION_COMPLETED',
  STUDENT_MODEL_SYNC_REQUESTED: 'STUDENT_MODEL_SYNC_REQUESTED',
  FORGETTING_SCAN_REQUESTED: 'FORGETTING_SCAN_REQUESTED',
  STAGNATION_SCAN_REQUESTED: 'STAGNATION_SCAN_REQUESTED',
  PATTERN_MEMORY_SCAN_REQUESTED: 'PATTERN_MEMORY_SCAN_REQUESTED',
} as const;

export type AmauraEventType = typeof AMAURA_EVENTS[keyof typeof AMAURA_EVENTS];
export type AmauraLegacyEventType = typeof AMAURA_LEGACY_EVENTS[keyof typeof AMAURA_LEGACY_EVENTS];

export const AMAURA_CONSUMERS = [
  'amaura_goal_decomposer',
  'amaura_plan_adapter',
  'amaura_progress_evaluator',
  'amaura_next_action',
  'amaura_practice_agent',
  'amaura_session_agent',
  'amaura_autopsy_cascade',
  'amaura_forgetting_agent',
  'amaura_stagnation_agent',
  'amaura_pattern_memory',
] as const;

export type AmauraConsumer = typeof AMAURA_CONSUMERS[number];

export const SAFE_BOUNDED_CONSUMERS = [
  'amaura_goal_decomposer',
  'amaura_plan_adapter',
  'amaura_progress_evaluator',
  'amaura_next_action',
  'amaura_practice_agent',
  'amaura_session_agent',
  'amaura_autopsy_cascade',
  'amaura_forgetting_agent',
  'amaura_stagnation_agent',
  'amaura_pattern_memory',
] as const satisfies readonly AmauraConsumer[];

export const AMAURA_EVENT_MATRIX = {
  [AMAURA_EVENTS.AMAURA_GOAL_CREATED]: [
    'amaura_goal_decomposer',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_GOAL_UPDATED]: [
    'amaura_progress_evaluator',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_TASK_CREATED]: [
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_TASK_COMPLETED]: [
    'amaura_progress_evaluator',
    'amaura_plan_adapter',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_TASK_SKIPPED]: [
    'amaura_progress_evaluator',
    'amaura_plan_adapter',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_OBSERVATION_RECORDED]: [
    'amaura_progress_evaluator',
    'amaura_plan_adapter',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_PLAN_ADAPTED]: [
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_GOAL_PROGRESS_EVALUATED]: [
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.AMAURA_NEXT_ACTION_UPDATED]: [],
  [AMAURA_EVENTS.AUTOPSY_V3_REPORT_READY]: [
    'amaura_autopsy_cascade',
    'amaura_plan_adapter',
    'amaura_progress_evaluator',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.MEMORY_REVIEW_COMPLETED]: [
    'amaura_progress_evaluator',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.ATLAS_CONCEPT_UPDATED]: [
    'amaura_plan_adapter',
    'amaura_progress_evaluator',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.SESSION_CLOSED]: [
    'amaura_session_agent',
    'amaura_progress_evaluator',
    'amaura_next_action',
  ],
  [AMAURA_EVENTS.DAILY_AGENT_TICK]: [
    'amaura_forgetting_agent',
    'amaura_stagnation_agent',
    'amaura_pattern_memory',
    'amaura_progress_evaluator',
    'amaura_next_action',
  ],
  [AMAURA_LEGACY_EVENTS.PRACTICE_ATTEMPT_SUBMITTED]: ['amaura_practice_agent'],
  [AMAURA_LEGACY_EVENTS.PRACTICE_ATTEMPT_RECORDED]: ['amaura_practice_agent'],
  [AMAURA_LEGACY_EVENTS.STUDY_SESSION_COMPLETED]: ['amaura_session_agent'],
  [AMAURA_LEGACY_EVENTS.STUDENT_MODEL_SYNC_REQUESTED]: [
    'amaura_forgetting_agent',
    'amaura_stagnation_agent',
    'amaura_pattern_memory',
  ],
  [AMAURA_LEGACY_EVENTS.FORGETTING_SCAN_REQUESTED]: ['amaura_forgetting_agent'],
  [AMAURA_LEGACY_EVENTS.STAGNATION_SCAN_REQUESTED]: ['amaura_stagnation_agent'],
  [AMAURA_LEGACY_EVENTS.PATTERN_MEMORY_SCAN_REQUESTED]: ['amaura_pattern_memory'],
} as const satisfies Record<string, readonly AmauraConsumer[]>;

export type AmauraMatrixEventType = keyof typeof AMAURA_EVENT_MATRIX;

export function getConsumersForEvent(eventType: string): readonly AmauraConsumer[] {
  return AMAURA_EVENT_MATRIX[eventType as AmauraMatrixEventType] ?? [];
}

export function assertEventMatrixIntegrity() {
  const knownConsumers = new Set<string>(AMAURA_CONSUMERS);
  const safeConsumers = new Set<string>(SAFE_BOUNDED_CONSUMERS);

  for (const [eventType, consumers] of Object.entries(AMAURA_EVENT_MATRIX)) {
    for (const consumer of consumers) {
      if (!knownConsumers.has(consumer)) {
        throw new Error(`Unknown Amaura consumer ${consumer} registered for ${eventType}`);
      }
      if (!safeConsumers.has(consumer)) {
        throw new Error(`Amaura consumer ${consumer} is not in the bounded safe allowlist`);
      }
    }
  }

  return true;
}
