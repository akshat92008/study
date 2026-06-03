// lib/hermes/schemas/source.schema.ts
import { z } from 'zod';

export const HermesSourceResultSchema = z.object({
  sourceSummary: z.string().min(1).max(2000),
  extractedConcepts: z.array(
    z.object({
      subject: z.string().nullable(),
      chapter: z.string().nullable(),
      topic: z.string().min(1).max(200),
      importance: z.enum(['low', 'medium', 'high']),
    })
  ).max(20),
  suggestedCards: z.array(
    z.object({
      front: z.string().min(1).max(500),
      back: z.string().min(1).max(1000),
      type: z.enum(['definition', 'concept', 'formula', 'application']),
    })
  ).max(10),
  suggestedPracticePrompts: z.array(z.string().max(300)).max(5),
  nextAction: z.object({
    label: z.string().min(1).max(200),
    rationale: z.string().min(1).max(500),
    estimatedMinutes: z.number().int().min(1).max(120),
  }),
});

export type HermesSourceResultSchema = z.infer<typeof HermesSourceResultSchema>;
