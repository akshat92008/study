import { z } from 'zod';
import { EventTypes } from './types';

export const EventTypeSchema = z.enum([
  'MIND_MESSAGE_CREATED',
  'CHAT_MESSAGE_PROCESSED',
  'MIND_TUTOR_COMPLETED',
  'AUTOPSY_MOCK_PROCESSED',
  'ATLAS_MASTERY_UPDATED',
  'MEMORY_CARD_CREATED',
  'MEMORY_CARD_REVIEWED',
  'COMMAND_SESSION_CREATED',
  'COMMAND_SESSION_COMPLETED',
  'COMMAND_TASK_COMPLETED',
  'COMMAND_TASK_DELAYED',
  'STUDY_SESSION_COMPLETED',
  'CONCEPT_DISCOVERED',
  'INGESTION_DOCUMENT_PROCESSED',
]);

export type EventType = z.infer<typeof EventTypeSchema>;

export const StudentEventInputSchema = z.object({
  type: z.enum(Object.keys(EventTypes) as [keyof typeof EventTypes]),
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
  status: z.enum(['pending', 'processing', 'completed', 'failed']).default('pending'),
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
  CHAT_MESSAGE_PROCESSED: z.object({
    sessionId: z.string().min(1),
    message: z.string().min(1),
    fullResponse: z.string(),
    emotion: z.string().optional(),
    history: z.array(z.any()).optional(),
    intent: z.any().optional(),
  }),
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
  COMMAND_SESSION_COMPLETED: z.object({
    sessionId: z.string().min(1),
    taskId: z.string().optional(),
    subject: z.string().min(1),
    chapter: z.string().min(1),
    durationMinutes: z.number().nonnegative().optional(),
    understood: z.boolean().optional(),
    isSessionComplete: z.boolean().optional(),
    conceptId: MaybeUuid,
  }).passthrough(),
  STUDY_SESSION_COMPLETED: z.object({
    sessionId: z.string().min(1),
    subject: z.string().min(1),
    chapter: z.string().min(1),
    durationMinutes: z.number().nonnegative().optional(),
    conceptId: MaybeUuid,
  }).passthrough(),
  MIND_TUTOR_COMPLETED: z.object({
    subject: z.string().min(1),
    chapter: z.string().min(1),
    durationMinutes: z.number().nonnegative().optional(),
    conceptId: MaybeUuid,
  }).passthrough(),
  MEMORY_CARD_REVIEWED: z.object({
    cardId: z.string().min(1),
    conceptId: MaybeUuid,
    rating: z.union([z.number(), z.string()]),
  }).passthrough(),
  CONCEPT_DISCOVERED: z.object({
    conceptId: MaybeUuid,
    subject: z.string().optional(),
    chapter: z.string().optional(),
    topic: z.string().optional(),
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
