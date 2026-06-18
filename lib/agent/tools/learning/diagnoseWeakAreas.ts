import type { AgentToolDefinition } from '@/lib/agent/types';
import { DiagnoseWeakAreasInputSchema, ToolResultSchema } from '@/lib/agent/tools/schemas';
import { dependencyConceptsFor } from '@/lib/atlas/conceptResolver';

import { isPlaceholderTitle } from '@/lib/topic-seeding/templates/neet/topic-skeleton';

export const diagnoseWeakAreasTool: AgentToolDefinition<typeof DiagnoseWeakAreasInputSchema, typeof ToolResultSchema> = {
  name: 'diagnose_weak_areas',
  description: 'Infer weak areas and dependencies from recent signals and context.',
  inputSchema: DiagnoseWeakAreasInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 1,
  requiresAuth: true,
  async handler(input) {
    const weakAreas = input.signals
      .filter((signal) => ['weak_area_detected', 'misconception_detected', 'practice_needed', 'revision_needed'].includes(signal.type))
      .map((signal) => {
        const concept = signal.canonicalConcept ?? signal.concept ?? 'Unclassified Weak Area';
        const isPlaceholder = isPlaceholderTitle(concept);
        return {
          concept,
          subject: signal.subject ?? null,
          chapter: signal.chapter ?? null,
          reason: signal.type,
          confidence: isPlaceholder ? 0.1 : signal.confidence,
          dependencies: dependencyConceptsFor(concept),
        };
      });

    return {
      success: true,
      changed: false,
      entityType: 'weak_area_diagnosis',
      entityIds: [],
      summary: `Diagnosed ${weakAreas.length} weak area${weakAreas.length === 1 ? '' : 's'}.`,
      data: { weakAreas },
    };
  },
};

