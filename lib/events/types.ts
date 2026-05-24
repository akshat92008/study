// lib/events/types.ts
// FIX FAILURE 1: Previously CognitionEventType enum had values like 'mastery_changed'
// but schema.ts Zod enum had 'MIND_TUTOR_COMPLETED' and engines inserted 'AUTOPSY_COMPLETE'.
// Three systems, zero agreement. Events were silently dropped.
//
// NOW: This enum mirrors schema.ts exactly so EventWorker, schema validation,
// and engine inserts all use the same string values.

export enum CognitionEventType {
  MindTutorCompleted = 'MIND_TUTOR_COMPLETED',
  AutopsyMockProcessed = 'AUTOPSY_MOCK_PROCESSED',
  MemoryCardReviewed = 'MEMORY_CARD_REVIEWED',
  CommandTaskCompleted = 'COMMAND_TASK_COMPLETED',
  CommandTaskDelayed = 'COMMAND_TASK_DELAYED',
  PulseFrictionDetected = 'PULSE_FRICTION_DETECTED',
  AtlasMasteryUpdated = 'ATLAS_MASTERY_UPDATED',

  // Legacy events for EventWorker and its tests
  MasteryChanged = 'mastery_changed',
  RetrievalSucceeded = 'retrieval_succeeded',
  RetrievalFailed = 'retrieval_failed',
}
