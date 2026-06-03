// lib/hermes/schemas/next-action.schema.ts
import { z } from 'zod';

export const HermesNextActionResultSchema = z.object({
  nextAction: z.object({
    label: z.string().min(1).max(200),
    actionType: z.enum(['review', 'practice', 'source', 'mistake_review', 'mind_chat']),
    rationale: z.string().min(1).max(500),
    estimatedMinutes: z.number().int().min(1).max(120),
  }),
  microtasks: z.array(
    z.object({
      title: z.string().min(1).max(200),
      type: z.string().min(1).max(50),
      estimatedMinutes: z.number().int().min(1).max(60),
    })
  ).max(5),
});

export type HermesNextActionResultSchema = z.infer<typeof HermesNextActionResultSchema>;
