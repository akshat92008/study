import { z } from 'zod';


export const EventTypeSchema = z.enum([
  'MIND_MESSAGE_CREATED',
  'CHAT_MESSAGE_PROCESSED',
  'CHAT_SESSION_SUMMARIZE',
  'MIND_TUTOR_COMPLETED',
  'MATERIAL_UPLOADED',
  'MATERIAL_INGESTION_REQUESTED',
  'MATERIAL_INGESTED',
  'RAG_QUERY_USED',
  'RAG_CARD_CANDIDATE_CREATED',
  'MIND_ACTION_REQUESTED',
  'MIND_CONTEXT_REFRESHED',
  'AUTOPSY_UPLOAD_RECEIVED',
  'AUTOPSY_PROCESSING_COMPLETED',
  'AUTOPSY_MISTAKE_EXTRACTED',
  'AUTOPSY_MISTAKE_APPROVED',
  'AUTOPSY_MISTAKE_REJECTED',
  'AUTOPSY_MOCK_PROCESSED',
  'ATLAS_MASTERY_UPDATE_REQUESTED',
  'ATLAS_MASTERY_UPDATED',
  'MEMORY_CARD_CREATE_REQUESTED',
  'MEMORY_CARD_CREATED',
  'MEMORY_CARD_REVIEWED',
  'REVISION_CARD_REVIEWED',
  'STUDY_SESSION_COMPLETED',
  'SESSION_CARD_COMPLETED',
  'SESSION_RECOMMENDATION_REQUESTED',
  'SESSION_RECOMMENDATION_CREATED',
  'CONCEPT_DISCOVERED',
  'INGESTION_DOCUMENT_PROCESSED',
  'LEARNER_STATE_CHANGED',
  'STUDENT_MODEL_SYNC_REQUESTED',
  'PLANNER_REPLAN_REQUESTED',
  'PRACTICE_ATTEMPT_RECORDED',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const StudentEventInputSchema = z.object({
  type: EventTypeSchema,
  source: z.string().optional(),
  data: z.any(), // payload can be any JSON‑serialisable object
  idempotencyKey: z.string().uuid().optional(), // optional UUID, generate client‑side if needed
});

export type StudentEventInput = z.infer<typeof StudentEventInputSchema>;

export const EventMetadataSchema = z.object({
  source: z.string().optional(),
  client_timestamp: z.string().optional(),
  session_id: z.string().optional(),
}).catchall(z.any());

export const StrictStudentEventSchema = z.object({
  id: z.string().uuid().optional(),
  user_id: z.string().uuid(),
  type: z.string(),
  data: z.any(),
  status: z.enum(['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL_FAILED']).default('PENDING'),
  idempotency_key: z.string().optional(),
  retry_count: z.number().default(0),
  error_message: z.string().nullable().optional(),
  last_error: z.string().nullable().optional(),
  created_at: z.string().datetime().optional(),
  version: z.string().default('v2'),
  trace_id: z.string().uuid().optional(),
  metadata: EventMetadataSchema.default({}),
});

export type StrictStudentEvent = z.infer<typeof StrictStudentEventSchema>;

const EventBaseSchema = z.object({
  user_id: z.string().uuid(),
});

const MaybeUuid = z.string().uuid().optional().nullable();

export const EventPayloadSchemas: Partial<Record<EventType | string, z.ZodTypeAny>> = {
  // MODULE 3: assistant_message_id is set by the route before publishing.
  // The worker uses it as a stable reference and must never re-insert the message.
  CHAT_MESSAGE_PROCESSED: z.object({
    sessionId: z.string().min(1),
    message: z.string().min(1),
    fullResponse: z.string(),
    emotion: z.string().optional(),
    history: z.array(z.any()).optional(),
    sessionTurnsCount: z.number().optional(),
    mindContext: z.any().optional(),
    intent: z.any().optional(),
    metadataPayload: z.any().optional(),
    source_type: z.string().optional(),
    user_message_id: z.string().uuid().optional(),
    /** ID of the already-persisted assistant chat_messages row. */
    assistant_message_id: z.string().uuid().optional(),
  }),
  CHAT_SESSION_SUMMARIZE: z.object({
    sessionId: z.string().min(1),
  }).passthrough(),
  MATERIAL_UPLOADED: z.object({
    materialId: z.string().uuid(),
  }).passthrough(),
  MATERIAL_INGESTION_REQUESTED: z.object({
    materialId: z.string().uuid(),
  }).passthrough(),
  MATERIAL_INGESTED: z.object({
    materialId: z.string().uuid(),
    chunkCount: z.number().int().nonnegative().optional(),
  }).passthrough(),
  RAG_QUERY_USED: z.object({
    query: z.string().optional(),
    materialIds: z.array(z.string().uuid()).optional(),
    chunkIds: z.array(z.string().uuid()).optional(),
    messageId: z.string().uuid().optional(),
  }).passthrough(),
  RAG_CARD_CANDIDATE_CREATED: z.object({
    materialId: z.string().uuid().optional(),
    chunkId: z.string().uuid().optional(),
    conceptId: MaybeUuid,
  }).passthrough(),
  MIND_ACTION_REQUESTED: z.object({
    action: z.string().min(1),
  }).passthrough(),
  MIND_CONTEXT_REFRESHED: z.object({
    reason: z.string().optional(),
  }).passthrough(),
  AUTOPSY_UPLOAD_RECEIVED: z.object({
    jobId: z.string().min(1),
  }).passthrough(),
  AUTOPSY_PROCESSING_COMPLETED: z.object({
    autopsyId: z.string().min(1).optional(),
    jobId: z.string().min(1).optional(),
  }).passthrough(),
  AUTOPSY_MISTAKE_EXTRACTED: z.object({
    autopsyId: z.string().min(1),
  }).passthrough(),
  AUTOPSY_MISTAKE_APPROVED: z.object({
    autopsyId: z.string().min(1).optional(),
    mistake: z.any().optional(),
    wrongQuestions: z.array(z.any()).optional(),
  }).passthrough(),
  AUTOPSY_MISTAKE_REJECTED: z.object({
    autopsyId: z.string().min(1).optional(),
    mistakeId: z.string().min(1).optional(),
  }).passthrough(),
  AUTOPSY_MOCK_PROCESSED: z.object({
    autopsyId: z.string().min(1),
    testName: z.string().optional(),
    examType: z.string().optional(),
    rawScore: z.number().optional(),
    recoverableScore: z.number().optional(),
    potentialScore: z.number().optional(),
    totalQuestions: z.number().int().nonnegative().optional(),
    correctCount: z.number().int().nonnegative().optional(),
    incorrectCount: z.number().int().nonnegative().optional(),
  }).passthrough(),
  STUDY_SESSION_COMPLETED: z.object({
    sessionId: z.string().min(1),
    subject: z.string().min(1),
    chapter: z.string().min(1),
    durationMinutes: z.number().nonnegative().optional(),
    conceptId: MaybeUuid,
  }).passthrough(),
  MIND_TUTOR_COMPLETED: z.object({
    sessionId: z.string().min(1).optional(),
    subject: z.string().min(1),
    chapter: z.string().min(1),
    durationMinutes: z.number().nonnegative().optional(),
    conceptId: MaybeUuid,
    messageCount: z.number().nonnegative().optional(),
    coverageTurns: z.number().nonnegative().optional(),
    minCoverageTurns: z.number().nonnegative().optional(),
    isSessionComplete: z.boolean().optional(),
  }).passthrough(),
  MEMORY_CARD_REVIEWED: z.object({
    cardId: z.string().min(1),
    conceptId: MaybeUuid,
    rating: z.union([z.number(), z.string()]),
  }).passthrough(),
  REVISION_CARD_REVIEWED: z.object({
    cardId: z.string().min(1),
    conceptId: MaybeUuid,
    rating: z.union([z.number(), z.string()]),
  }).passthrough(),
  MEMORY_CARD_CREATE_REQUESTED: z.object({
    conceptId: MaybeUuid,
    sourceType: z.string().optional(),
    sourceId: z.string().optional(),
  }).passthrough(),
  ATLAS_MASTERY_UPDATE_REQUESTED: z.object({
    conceptId: z.string().uuid().optional(),
    delta: z.number().optional(),
  }).passthrough(),
  SESSION_CARD_COMPLETED: z.object({
    sessionId: z.string().min(1).optional(),
    subject: z.string().optional(),
    chapter: z.string().optional(),
  }).passthrough(),
  SESSION_RECOMMENDATION_REQUESTED: z.object({
    reason: z.string().optional(),
  }).passthrough(),
  SESSION_RECOMMENDATION_CREATED: z.object({
    sessionCardId: z.string().uuid().optional(),
  }).passthrough(),
  CONCEPT_DISCOVERED: z.object({
    conceptId: MaybeUuid,
    subject: z.string().optional(),
    chapter: z.string().optional(),
    topic: z.string().optional(),
  }).passthrough(),
  LEARNER_STATE_CHANGED: z.object({
    reason: z.string().optional(),
  }).passthrough(),
  STUDENT_MODEL_SYNC_REQUESTED: z.object({
    reason: z.string().optional(),
  }).passthrough(),
  PLANNER_REPLAN_REQUESTED: z.object({
    reason: z.string().optional(),
    date: z.string().optional(),
  }).passthrough(),
  PRACTICE_ATTEMPT_RECORDED: z.object({
    practiceSetId: z.string().uuid(),
    setType: z.enum(['mcq', 'flashcard']),
    metrics: z.object({
      correctCount: z.number().int().nonnegative().optional(),
      wrongCount: z.number().int().nonnegative().optional(),
      reviewedCount: z.number().int().nonnegative().optional(),
      wrongConceptIds: z.array(z.string().uuid()).optional(),
      wrongConceptNames: z.array(z.string()).optional(),
    }).optional(),
    items: z.array(z.object({
      practiceItemId: z.string().uuid(),
      conceptId: MaybeUuid,
      conceptName: z.string().optional(),
      isCorrect: z.boolean().optional(),
      confidence: z.string().optional(),
    })).optional()
  }).passthrough(),
};

export function validateEventEnvelope(input: {
  user_id: string;
  type: string;
  data?: unknown;
}): void {
  EventBaseSchema.parse({ user_id: input.user_id });

  const schema = EventPayloadSchemas[input.type];
  if (!schema) return;
  schema.parse(input.data ?? {});
}
