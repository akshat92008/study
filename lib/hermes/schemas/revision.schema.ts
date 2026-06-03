// lib/hermes/schemas/revision.schema.ts
import { z } from 'zod';
import { HermesCardSchema } from './mistake.schema';

export const HermesRevisionResultSchema = z.object({
  improvedCards: z.array(HermesCardSchema.extend({
    cardId: z.string(),
    improvementReason: z.string().optional(),
  })).min(1).max(10),
  rejectedCardIds: z.array(z.string()),
  reason: z.string().min(1).max(500),
});

export type HermesRevisionResultSchema = z.infer<typeof HermesRevisionResultSchema>;
