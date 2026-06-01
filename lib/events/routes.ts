export const EVENT_CONSUMERS = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'command_engine',
  'autopsy_engine',
  'concept_expansion_engine',
  'chat_side_effect_engine',
] as const;

export type EventConsumer = typeof EVENT_CONSUMERS[number];

export const EVENT_CONSUMER_MATRIX = {
  CHAT_MESSAGE_PROCESSED: ['chat_side_effect_engine'],
  CHAT_SESSION_SUMMARIZE: ['chat_side_effect_engine'],
  AUTOPSY_UPLOAD_RECEIVED: ['autopsy_engine'],
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
  ATLAS_MASTERY_UPDATED: ['learning_state_engine'],
  MEMORY_CARD_CREATED: ['learning_state_engine'],
  CONCEPT_DISCOVERED: ['concept_expansion_engine'],
  INGESTION_DOCUMENT_PROCESSED: ['learning_state_engine'],
  MIND_MESSAGE_CREATED: ['learning_state_engine'],
  STUDENT_MODEL_SYNC_REQUESTED: ['learning_state_engine', 'command_engine'],
  PRACTICE_ATTEMPT_RECORDED: [
    'atlas_engine',
    'memory_engine',
    'learning_state_engine',
  ],
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
