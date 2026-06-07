import { z } from 'zod';

export const JsonObjectSchema = z.record(z.unknown());

export const ToolResultSchema = z.object({
  success: z.boolean(),
  changed: z.boolean(),
  entityType: z.string().optional(),
  entityIds: z.array(z.string()).optional(),
  summary: z.string(),
  data: JsonObjectSchema.optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: JsonObjectSchema.optional(),
  }).optional(),
});

export const LearningSignalSchema = z.object({
  type: z.enum([
    'weak_area_detected',
    'misconception_detected',
    'concept_understood',
    'source_used',
    'revision_needed',
    'practice_needed',
    'explanation_generated',
    'session_should_adapt',
    'practice_attempt_submitted',
    'revision_reviewed',
    'session_completed',
  ]),
  concept: z.string().min(1).optional(),
  canonicalConcept: z.string().min(1).optional(),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  confidence: z.number().min(0).max(1),
  evidence: z.string().optional(),
  source: z.enum(['chat', 'practice', 'autopsy', 'revision', 'session', 'source']).optional(),
  materialId: z.string().uuid().optional(),
  materialTitle: z.string().optional(),
  chunkIds: z.array(z.string().uuid()).optional(),
  attemptId: z.string().optional(),
  correct: z.boolean().optional(),
  misconception: z.string().optional(),
  correction: z.string().optional(),
  metadata: JsonObjectSchema.optional(),
});

export const RetrievedChunkSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  title: z.string(),
  text: z.string(),
  score: z.number(),
  method: z.enum(['vector', 'keyword']),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  heading: z.string().nullable().optional(),
  pageStart: z.number().nullable().optional(),
  pageEnd: z.number().nullable().optional(),
});

export const EmptyInputSchema = z.object({}).default({});

export const GetLearnerContextInputSchema = z.object({
  goalId: z.string().uuid().nullable().optional(),
});

export const RetrieveSourceChunksInputSchema = z.object({
  query: z.string().min(1),
  materialIds: z.array(z.string().uuid()).optional(),
  goalId: z.string().uuid().nullable().optional(),
  limit: z.number().int().min(1).max(8).default(5),
  force: z.boolean().default(false),
});

export const ExtractLearningSignalsInputSchema = z.object({
  userMessage: z.string().default(''),
  assistantMessage: z.string().default(''),
  channel: z.enum(['chat', 'practice', 'autopsy', 'revision', 'session']).default('chat'),
  payload: JsonObjectSchema.default({}),
  retrievedChunks: z.array(RetrievedChunkSchema).default([]),
  contextSummary: JsonObjectSchema.default({}),
});

export const DiagnoseWeakAreasInputSchema = z.object({
  signals: z.array(LearningSignalSchema).default([]),
  recentContext: JsonObjectSchema.default({}),
});

export const UpsertAtlasConceptInputSchema = z.object({
  concept: z.string().min(1),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

export const UpdateConceptMasteryInputSchema = z.object({
  conceptId: z.string().uuid(),
  signal: LearningSignalSchema,
  evidenceRef: z.string().optional(),
});

export const CreateMemoryCardInputSchema = z.object({
  conceptId: z.string().uuid(),
  signal: LearningSignalSchema,
  sourceMaterialId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

export const UpdateMicrotargetInputSchema = z.object({
  eventType: z.string().min(1),
  conceptId: z.string().uuid().nullable().optional(),
  concept: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

export const WriteLearningEventInputSchema = z.object({
  eventType: z.string().min(1),
  payload: JsonObjectSchema.default({}),
  goalId: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().optional(),
});

export const ApplyPracticeAttemptInputSchema = z.object({
  practiceSetId: z.string().optional(),
  metrics: JsonObjectSchema.default({}),
  items: z.array(JsonObjectSchema).default([]),
  goalId: z.string().uuid().nullable().optional(),
});

export const CompleteSessionInputSchema = z.object({
  sessionId: z.string().nullable().optional(),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  conceptName: z.string().nullable().optional(),
  durationMinutes: z.number().nullable().optional(),
  understood: z.boolean().nullable().optional(),
  gapFound: z.string().nullable().optional(),
  cardsCreated: z.number().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

export const AdaptDailyPlanInputSchema = z.object({
  reason: z.string().min(1),
  weakConcepts: z.array(z.string()).default([]),
  goalId: z.string().uuid().nullable().optional(),
});

export const RecordAutopsyMistakeInputSchema = z.object({
  concept: z.string().min(1),
  mistakeText: z.string().min(1),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  correctAnswer: z.string().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
});

