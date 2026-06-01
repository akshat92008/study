// lib/planners/adaptivePlanner.ts

/**
 * AdaptivePlanner provides a hook for adaptive prompt planning based on learner state.
 * It now fetches the learner's mastery scores and includes a brief summary in the plan.
 * Future enhancements may use sophisticated models or rule‑based heuristics.
 */
import { plannerInvocationCounter, plannerLatency } from '@/telemetry/metrics';
import { trace } from '@/telemetry/otel';
import { LearnerStateService } from '@/services/learnerStateService';

export class AdaptivePlanner {
  /**
   * Generate a plan or customized prompt segment for a given user.
   * @param userId Identifier of the learner.
   * @param context Any contextual data (e.g., assembled prompt, learner state) that the planner can use.
   * @returns A string representing planner output – includes a simple mastery overview.
   */
  async plan(userId: string, context: any): Promise<string> {
    const span = trace.startSpan('adaptivePlanner.plan');
    const start = Date.now();
    try {
      // Fetch learner mastery data.
      const service = new LearnerStateService();
      const states = await service.getForUser(userId);
      // Build a simple overview string.
      const masterySummary = states
        .map((s) => `${s.conceptId.slice(0, 8)}:${(s.masteryScore * 100).toFixed(0)}%`)
        .join(', ');
      const basePlan = `Adaptive plan for user ${userId}`;
      const overview = masterySummary ? `\nLearner mastery snapshot: ${masterySummary}` : '';
      // Record metric
      plannerInvocationCounter.add(1, { userId });
      return `${basePlan}${overview}`;
    } finally {
      const duration = Date.now() - start;
      plannerLatency.record(duration, { userId });
      span.end();
    }
  }
}
