// lib/hermes/schemas/mistake.schema.ts
// Zod schema for HermesMistakeResult.
// Every Hermes output MUST be validated against this schema before writing to DB.

import { z } from 'zod';

export const HermesMistakeCategorySchema = z.enum([
  'conceptual_gap',
  'misread',
  'calculation_error',
  'formula_recall',
  'wrong_diagnostic_frame',
  'application_error',
  'time_pressure',
  'silly_error',
  'exam_strategy',
  'unknown',
]);

export const HermesCardTypeSchema = z.enum([
  'mistake_concept',
  'error_pattern',
  'similar_trap',
  'formula_recall',
  'source_grounded',
]);

export const HermesCardDifficultySchema = z.enum(['easy', 'medium', 'hard']);

export const HermesCardSchema = z.object({
  front: z.string().min(1).max(1000),
  back: z.string().min(1).max(2000),
  type: HermesCardTypeSchema,
  difficulty: HermesCardDifficultySchema,
});

export const HermesNextActionSchema = z.object({
  label: z.string().min(1).max(200),
  rationale: z.string().min(1).max(500),
  estimatedMinutes: z.number().int().min(1).max(120),
  actionType: z.enum(['review_cards', 'practice_similar', 'read_source', 'ask_mind', 'redo_question']),
});

export const HermesWeakConceptSchema = z.object({
  subject: z.string().nullable(),
  chapter: z.string().nullable(),
  topic: z.string().nullable(),
  name: z.string().min(1).max(200),
});

export const HermesSafetyFlagsSchema = z.object({
  possibleHallucination: z.boolean(),
  needsHumanReview: z.boolean(),
  reason: z.string().optional(),
});

export const HermesMistakeResultSchema = z.object({
  category: HermesMistakeCategorySchema,
  subject: z.string().nullable(),
  chapter: z.string().nullable(),
  topic: z.string().nullable(),
  diagnosis: z.string().min(1).max(1000),
  whyMyAnswerWasWrong: z.string().min(1).max(1000),
  whyCorrectAnswerWorks: z.string().min(1).max(1000),
  keyMissedClue: z.string().max(500).nullable(),
  confidence: z.enum(['low', 'medium', 'high']),
  weakConcept: HermesWeakConceptSchema,
  cards: z.array(HermesCardSchema).min(1).max(10),
  nextAction: HermesNextActionSchema,
  safetyFlags: HermesSafetyFlagsSchema,
});

export type HermesMistakeResultSchema = z.infer<typeof HermesMistakeResultSchema>;
