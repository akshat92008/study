import { z } from 'zod';
import { EventTypes } from './types';

export const EventTypeSchema = z.enum([
  'MIND_MESSAGE_CREATED',
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
