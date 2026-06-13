import {
  AMAURA_CONSUMERS,
  AMAURA_EVENT_MATRIX,
  AMAURA_EVENTS,
} from '@/lib/amaura/events/event-matrix';

export const EVENT_CONSUMERS = [
  
  'atlas_engine',
  'memory_engine',
  'autopsy_engine',
  'concept_expansion_engine',
  'chat_side_effect_engine',
  'mind_agent',
  'rag_agent',
  'atlas_agent',
  'memory_agent',
  'autopsy_agent',
  'planner_agent',
  'command_agent',
  ...AMAURA_CONSUMERS,
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

export type EventHandlingMode = "mutating" | "audit_only" | "disabled";

export const EVENT_CONSUMER_MATRIX = {
  CHAT_MESSAGE_PROCESSED: ['chat_side_effect_engine', 'mind_agent'],
  CHAT_MESSAGE_CREATED: ['chat_side_effect_engine', 'mind_agent'],
  CHAT_LEARNING_SIGNAL: [ 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent'],
  CHAT_SESSION_SUMMARIZE: ['chat_side_effect_engine'],
  MATERIAL_UPLOADED: ['rag_agent'],
  MATERIAL_INGESTION_REQUESTED: ['rag_agent'],
  MATERIAL_INGESTED: ['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent'],
  RAG_QUERY_USED: ['mind_agent'],
  RAG_CARD_CANDIDATE_CREATED: ['memory_agent'],
  MIND_ACTION_REQUESTED: ['mind_agent'],
  MIND_CONTEXT_REFRESHED: ['mind_agent'],
  AUTOPSY_UPLOAD_RECEIVED: ['autopsy_engine'],
  MOCK_TEST_UPLOADED: ['autopsy_engine'],
  AUTOPSY_PROCESSING_COMPLETED: ['autopsy_agent', 'planner_agent'],
  TEST_ANALYSIS_COMPLETED: ['autopsy_agent', 'planner_agent', 'command_agent'],
  AUTOPSY_MISTAKE_EXTRACTED: ['autopsy_agent'],
  AUTOPSY_MISTAKE_APPROVED: ['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent'],
  AUTOPSY_MISTAKE_REJECTED: ['autopsy_agent'],
  AUTOPSY_MOCK_PROCESSED: [
    'atlas_engine',
    'memory_engine',
    
    'command_agent',
    'planner_agent',
  ],
  MOCK_TEST_ANALYZED: [
    'atlas_engine',
    'memory_engine',
    
    'command_agent',
    'planner_agent',
  ],
  AUTOPSY_V3_ASSESSMENT_CREATED: ['autopsy_agent'],
  AUTOPSY_V3_QUESTIONS_UPSERTED: ['autopsy_agent'],
  AUTOPSY_V3_REASONS_COLLECTED: ['autopsy_agent'],
  AUTOPSY_V3_REPORT_READY: [
    
    'memory_agent',
    'planner_agent',
    'command_agent',
    ...AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AUTOPSY_V3_REPORT_READY],
  ],
  LEARNING_SIGNAL_INGESTED: [ 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent'],
  STUDY_SESSION_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    
    'command_agent',
    'planner_agent',
    'amaura_session_agent',
  ],
  MIND_TUTOR_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    
    'command_agent',
    'planner_agent',
  ],
  MEMORY_CARD_REVIEWED: [ 'atlas_engine', 'command_agent', 'planner_agent'],
  REVISION_CARD_REVIEWED: ['memory_agent', 'atlas_agent', 'planner_agent'],
  REVISION_COMPLETED: ['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent'],
  MEMORY_CARD_CREATE_REQUESTED: ['memory_agent'],
  ATLAS_MASTERY_UPDATED: [ 'command_agent', 'planner_agent'],
  ATLAS_MASTERY_UPDATE_REQUESTED: ['atlas_agent'],
  MEMORY_CARD_CREATED: [ 'command_agent', 'planner_agent'],
  CONCEPT_DISCOVERED: ['concept_expansion_engine'],
  INGESTION_DOCUMENT_PROCESSED: [],
  MIND_MESSAGE_CREATED: [],
  SESSION_CARD_COMPLETED: ['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent'],
  SESSION_RECOMMENDATION_REQUESTED: ['planner_agent'],
  SESSION_RECOMMENDATION_CREATED: ['mind_agent'],
  LEARNER_STATE_CHANGED: ['planner_agent', 'mind_agent'],
  PLANNER_REPLAN_REQUESTED: ['planner_agent', 'command_agent'],
  STUDENT_MODEL_SYNC_REQUESTED: [
    
    'amaura_forgetting_agent',
    'amaura_stagnation_agent',
    'amaura_pattern_memory',
  ],
  FORGETTING_SCAN_REQUESTED: ['amaura_forgetting_agent'],
  STAGNATION_SCAN_REQUESTED: ['amaura_stagnation_agent'],
  PATTERN_MEMORY_SCAN_REQUESTED: ['amaura_pattern_memory'],
  PRACTICE_REQUESTED: ['amaura_practice_agent'],
  PRACTICE_SET_CREATED: ['mind_agent'],
  PRACTICE_ATTEMPT_RECORDED: [
    'atlas_engine',
    'memory_engine',
    
    'command_agent',
    'planner_agent',
    'amaura_practice_agent',
  ],
  PRACTICE_ATTEMPT_SUBMITTED: [
    'atlas_engine',
    'memory_engine',
    
    'command_agent',
    'planner_agent',
    'amaura_practice_agent',
  ],
  LEARNING_EVENT_APPLIED: ['mind_agent'],
  ONBOARDING_QUIZ_COMPLETE: [ 'planner_agent', 'command_agent'],
  AMAURA_GOAL_CREATED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_GOAL_CREATED],
  AMAURA_GOAL_UPDATED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_GOAL_UPDATED],
  AMAURA_TASK_CREATED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_TASK_CREATED],
  AMAURA_TASK_COMPLETED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_TASK_COMPLETED],
  AMAURA_TASK_SKIPPED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_TASK_SKIPPED],
  AMAURA_OBSERVATION_RECORDED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_OBSERVATION_RECORDED],
  AMAURA_PLAN_ADAPTED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_PLAN_ADAPTED],
  AMAURA_GOAL_PROGRESS_EVALUATED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.AMAURA_GOAL_PROGRESS_EVALUATED],
  MEMORY_REVIEW_COMPLETED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.MEMORY_REVIEW_COMPLETED],
  ATLAS_CONCEPT_UPDATED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.ATLAS_CONCEPT_UPDATED],
  SESSION_CLOSED: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.SESSION_CLOSED],
  DAILY_AGENT_TICK: AMAURA_EVENT_MATRIX[AMAURA_EVENTS.DAILY_AGENT_TICK],
} as const satisfies Record<string, readonly EventConsumer[]>;

export type RoutedEventType = keyof typeof EVENT_CONSUMER_MATRIX;

export function getConsumersForEvent(type: string): readonly EventConsumer[] {
  const consumers = EVENT_CONSUMER_MATRIX[type as RoutedEventType] ?? [];
  if (process.env.ENABLE_EXPERIMENTAL_AGENTS === 'true') {
    return consumers;
  }
  
  // Public Launch Routing Policy (Phase 11.1)
  const experimentalConsumers = new Set<string>([
    'concept_expansion_engine',
    'planner_agent',
    'command_agent',
    ...AMAURA_CONSUMERS,
  ]);
  
  return consumers.filter(c => !experimentalConsumers.has(c));
}

export function assertEventConsumerRoute(type: string, consumer: string): asserts consumer is EventConsumer {
  const expected = getConsumersForEvent(type);
  if (!expected.includes(consumer as EventConsumer)) {
    throw new Error(`Event routing error: ${consumer} is not registered for ${type}`);
  }
}
