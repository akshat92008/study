// lib/hermes/schemas/revision.schema.ts
import { z } from 'zod';
import { HermesCardSchema } from './mistake.schema';

export const HermesRevisionResultSchema = z.object({
  improvedCards: z.array(HermesCardSchema).min(1).max(10),
  rejectedCount: z.number().int().min(0),
  reason: z.string().min(1).max(500),
});

export type HermesRevisionResultSchema = z.infer<typeof HermesRevisionResultSchema>;
