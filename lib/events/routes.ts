export const EVENT_CONSUMERS = [
  'learning_state_engine',
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
  // Hermes internal worker consumer — never user-facing
  'hermes_worker',
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

export type EventHandlingMode = "mutating" | "audit_only" | "disabled";

export const EVENT_CONSUMER_MATRIX = {
  CHAT_MESSAGE_PROCESSED: ['chat_side_effect_engine', 'mind_agent'],
  CHAT_MESSAGE_CREATED: ['chat_side_effect_engine', 'mind_agent'],
  CHAT_LEARNING_SIGNAL: ['learning_state_engine', 'atlas_agent', 'memory_agent', 'command_agent', 'planner_agent'],
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
    'learning_state_engine',
    'command_agent',
    'planner_agent',
  ],
  MOCK_TEST_ANALYZED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
    'command_agent',
    'planner_agent',
  ],
  AUTOPSY_V3_ASSESSMENT_CREATED: ['autopsy_agent'],
  AUTOPSY_V3_QUESTIONS_UPSERTED: ['autopsy_agent'],
  AUTOPSY_V3_REASONS_COLLECTED: ['autopsy_agent', 'hermes_worker', 'learning_state_engine'],
  AUTOPSY_V3_REPORT_READY: ['learning_state_engine', 'memory_agent', 'planner_agent', 'command_agent', 'hermes_worker'],
  HERMES_MEMORY_UPDATED: ['memory_agent', 'planner_agent'],
  LEARNING_SIGNAL_INGESTED: ['learning_state_engine', 'atlas_agent', 'memory_agent', 'planner_agent', 'command_agent'],
  STUDY_SESSION_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
    'command_agent',
    'planner_agent',
  ],
  MIND_TUTOR_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
    'command_agent',
    'planner_agent',
  ],
  MEMORY_CARD_REVIEWED: ['learning_state_engine', 'atlas_engine', 'command_agent', 'planner_agent'],
  REVISION_CARD_REVIEWED: ['memory_agent', 'atlas_agent', 'planner_agent'],
  REVISION_COMPLETED: ['memory_agent', 'atlas_agent', 'planner_agent', 'command_agent'],
  MEMORY_CARD_CREATE_REQUESTED: ['memory_agent'],
  ATLAS_MASTERY_UPDATED: ['learning_state_engine', 'command_agent', 'planner_agent'],
  ATLAS_MASTERY_UPDATE_REQUESTED: ['atlas_agent'],
  MEMORY_CARD_CREATED: ['learning_state_engine', 'command_agent', 'planner_agent'],
  CONCEPT_DISCOVERED: ['concept_expansion_engine'],
  INGESTION_DOCUMENT_PROCESSED: ['learning_state_engine'],
  MIND_MESSAGE_CREATED: ['learning_state_engine'],
  SESSION_CARD_COMPLETED: ['atlas_agent', 'memory_agent', 'planner_agent', 'command_agent'],
  SESSION_RECOMMENDATION_REQUESTED: ['planner_agent'],
  SESSION_RECOMMENDATION_CREATED: ['mind_agent'],
  LEARNER_STATE_CHANGED: ['planner_agent', 'mind_agent'],
  PLANNER_REPLAN_REQUESTED: ['planner_agent', 'command_agent'],
  STUDENT_MODEL_SYNC_REQUESTED: ['learning_state_engine'],
  PRACTICE_ATTEMPT_RECORDED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
    'command_agent',
    'planner_agent',
  ],
  PRACTICE_ATTEMPT_SUBMITTED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
    'command_agent',
    'planner_agent',
  ],
  ONBOARDING_QUIZ_COMPLETE: ['learning_state_engine', 'planner_agent', 'command_agent'],
  // Hermes internal worker events — only consumed by hermes_worker
  HERMES_MISTAKE_REVIEW_REQUESTED: ['hermes_worker'],
  HERMES_SOURCE_PROCESS_REQUESTED: ['hermes_worker'],
  HERMES_REVISION_QUALITY_REQUESTED: ['hermes_worker'],
  HERMES_TRACE_REQUESTED: ['hermes_worker'],
  HERMES_NEXT_ACTION_REQUESTED: ['hermes_worker'],
} as const satisfies Record<string, readonly EventConsumer[]>;

export type RoutedEventType = keyof typeof EVENT_CONSUMER_MATRIX;

export function getConsumersForEvent(type: string): readonly EventConsumer[] {
  return EVENT_CONSUMER_MATRIX[type as RoutedEventType] ?? [];
}

export function assertEventConsumerRoute(type: string, consumer: string): asserts consumer is EventConsumer {
  const expected = getConsumersForEvent(type);
  if (!expected.includes(consumer as EventConsumer)) {
    throw new Error(`Event routing error: ${consumer} is not registered for ${type}`);
  }
}
