// lib/engines/masteryPropagation.ts

import { db } from '@/lib/db';
import { learnerState } from '@/db/learnerState';
import { LearnerStateService } from '@/services/learnerStateService';
import { getConceptGraph } from '@/graph/knowledgeGraph'; // placeholder import
import { masteryChangeCounter, masteryPropagationLatency } from '@/telemetry/metrics';
import { trace } from '@/telemetry/otel';

/**
 * Propagate mastery changes through prerequisite edges.
 * When a concept's mastery improves, we also boost its prerequisites slightly.
 */
export async function propagateMastery(userId: string, conceptId: string, newScore: number): Promise<void> {
  const span = trace.startSpan('masteryPropagation.propagate');
  const start = Date.now();
  try {
    const service = new LearnerStateService();
    // Update the target concept first.
    await service.upsert({ userId, conceptId, masteryScore: newScore, lastUpdated: new Date() });
    // Record metric for mastery change event
    masteryChangeCounter.add(1, { userId, conceptId });

    // Retrieve the concept graph (assume it provides getPrerequisites method).
    const graph = await getConceptGraph();
    const prereqs = graph.getPrerequisites(conceptId) ?? [];
    const decay = 0.1;

    for (const preId of prereqs) {
      // Fetch current mastery for prerequisite.
      const rows = await db
        .select()
        .from(learnerState)
        .where(learnerState.userId.eq(userId).and(learnerState.conceptId.eq(preId)));
      const current = rows[0] ? Number(rows[0].masteryScore) : 0;
      const updated = Math.min(1, current + decay * (newScore - current));
      await service.upsert({ userId, conceptId: preId, masteryScore: updated, lastUpdated: new Date() });
    }
  } finally {
    const duration = Date.now() - start;
    masteryPropagationLatency.record(duration, { userId, conceptId });
    span.end();
  }
}

