// lib/hermes/schemas/trace.schema.ts
import { z } from 'zod';

export const HermesTraceResultSchema = z.object({
  cognitiveTrace: z.object({
    repeatedWeaknesses: z.array(z.string().max(200)).max(10),
    avoidanceSignals: z.array(z.string().max(200)).max(5),
    forgettingRisks: z.array(z.string().max(200)).max(5),
    improvementSignals: z.array(z.string().max(200)).max(5),
  }),
  recommendations: z.array(
    z.object({
      type: z.enum(['review', 'practice', 'source_read', 'mistake_repair']),
      label: z.string().min(1).max(200),
      rationale: z.string().min(1).max(500),
    })
  ).max(5),
});

export type HermesTraceResultSchema = z.infer<typeof HermesTraceResultSchema>;
