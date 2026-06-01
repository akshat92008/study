export const EVENT_CONSUMERS = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'command_engine',
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
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

export const EVENT_CONSUMER_MATRIX = {
  CHAT_MESSAGE_PROCESSED: ['chat_side_effect_engine', 'mind_agent'],
  CHAT_SESSION_SUMMARIZE: ['chat_side_effect_engine'],
  MATERIAL_UPLOADED: ['rag_agent'],
  MATERIAL_INGESTION_REQUESTED: ['rag_agent'],
  MATERIAL_INGESTED: ['atlas_agent', 'memory_agent', 'planner_agent'],
  RAG_QUERY_USED: ['mind_agent'],
  RAG_CARD_CANDIDATE_CREATED: ['memory_agent'],
  MIND_ACTION_REQUESTED: ['mind_agent'],
  MIND_CONTEXT_REFRESHED: ['mind_agent'],
  AUTOPSY_UPLOAD_RECEIVED: ['autopsy_engine'],
  AUTOPSY_PROCESSING_COMPLETED: ['autopsy_agent', 'planner_agent'],
  AUTOPSY_MISTAKE_EXTRACTED: ['autopsy_agent'],
  AUTOPSY_MISTAKE_APPROVED: ['atlas_agent', 'memory_agent', 'planner_agent'],
  AUTOPSY_MISTAKE_REJECTED: ['autopsy_agent'],
  AUTOPSY_MOCK_PROCESSED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
  ],
  STUDY_SESSION_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
  ],
  MIND_TUTOR_COMPLETED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
  ],
  MEMORY_CARD_REVIEWED: ['learning_state_engine', 'atlas_engine'],
  REVISION_CARD_REVIEWED: ['memory_agent', 'atlas_agent', 'planner_agent'],
  MEMORY_CARD_CREATE_REQUESTED: ['memory_agent'],
  ATLAS_MASTERY_UPDATED: ['learning_state_engine'],
  ATLAS_MASTERY_UPDATE_REQUESTED: ['atlas_agent'],
  MEMORY_CARD_CREATED: ['learning_state_engine'],
  CONCEPT_DISCOVERED: ['concept_expansion_engine'],
  INGESTION_DOCUMENT_PROCESSED: ['learning_state_engine'],
  MIND_MESSAGE_CREATED: ['learning_state_engine'],
  SESSION_CARD_COMPLETED: ['atlas_agent', 'memory_agent', 'planner_agent'],
  SESSION_RECOMMENDATION_REQUESTED: ['planner_agent'],
  SESSION_RECOMMENDATION_CREATED: ['mind_agent'],
  LEARNER_STATE_CHANGED: ['planner_agent', 'mind_agent'],
  PLANNER_REPLAN_REQUESTED: ['planner_agent', 'command_agent'],
  STUDENT_MODEL_SYNC_REQUESTED: ['learning_state_engine', 'command_engine'],
  PRACTICE_ATTEMPT_RECORDED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
  ],
  ONBOARDING_QUIZ_COMPLETE: ['learning_state_engine', 'planner_agent'],
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
