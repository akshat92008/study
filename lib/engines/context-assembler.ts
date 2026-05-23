// lib/engines/context-assembler.ts

import { trace } from '@/telemetry/otel';
import { publishEvent } from '@/lib/events/publisher';
import { CognitionEventType } from '@/lib/events/types';
import { AdaptivePlanner } from '@/planners/adaptivePlanner';

/**
 * ContextAssembler is responsible for building the prompt that will be sent to the LLM.
 * It aggregates memory retrieval results, applies ranking weights, injects learner‑state
 * (mastery, emotional state), performs token budgeting/compression, and finally returns
 * the assembled prompt string.
 *
 * The implementation is intentionally modular – each step can be swapped out for a
 * more sophisticated component later.
 */
export class ContextAssembler {
  /**
   * Assemble the full context for a given user input.
   *
   * @param userId   Identifier of the learner (hashed UUID).
   * @param input    Raw user input string.
   * @returns       Fully prepared prompt ready for the LLM provider.
   */
  async assemble(userId: string, input: string): Promise<string> {
    const span = trace.startSpan('context.assemble', {
      attributes: { userId, inputLength: input.length },
    });
    try {
      // 1️⃣ Retrieve relevant memories (stub implementation).
      const rawMemories = await this.retrieveMemories(userId, input);

      // 2️⃣ Rank and filter memories according to the weighting scheme.
      const rankedMemories = this.rankMemories(rawMemories);

      // 3️⃣ Inject mastery and emotional state into the context.
      const enriched = await this.injectLearnerState(userId, rankedMemories);

      // 4️⃣ Compress / token‑budget the context to stay within limits.
      const compressed = await this.compressPrompt(enriched, input);

      // 5️⃣ Publish a successful context assembly event for telemetry.
      await publishEvent(userId, CognitionEventType.RetrievalSucceeded, {
        input,
        selectedMemoryCount: rankedMemories.length,
        finalPromptLength: compressed.length,
      });

          // Generate adaptive plan using the planner
    const planner = new AdaptivePlanner();
    const adaptivePlan = await planner.plan(userId, { compressed, input });
    // Combine adaptive plan with compressed prompt (placeholder logic)
    return `${adaptivePlan}\n${compressed}`;
    } catch (err) {
      // Emit a failure event.
      await publishEvent(userId, CognitionEventType.RetrievalFailed, {
        input,
        error: (err as Error).message,
      });
      throw err;
    } finally {
      span.end();
    }
  }

  /**
   * Stub for memory retrieval. In production this would call the ATLAS graph,
   * vector store, or other retrieval back‑ends.
   */
  private async retrieveMemories(userId: string, query: string): Promise<Array<{ id: string; content: string; score: number }>> {
    // Placeholder: return a few dummy memories.
    return [
      { id: 'mem1', content: 'Previous discussion about quantum entanglement.', score: 0.9 },
      { id: 'mem2', content: 'Learner struggled with Fourier transforms last week.', score: 0.8 },
    ];
  }

  /**
   * Apply the ranking weights (recency, mastery relevance, semantic similarity, emotional salience).
   * This is a simplified implementation; the real logic will use the configurable weights
   * stored in the learner state.
   */
  private rankMemories(memories: Array<{ id: string; content: string; score: number }>) {
    // For now we just sort by the existing `score` (higher first).
    return memories.sort((a, b) => b.score - a.score);
  }

  /**
   * Enrich the selected memories with mastery and emotional state data.
   * This stub fetches dummy data – replace with real DB look‑ups later.
   */
  private async injectLearnerState(
    userId: string,
    memories: Array<{ id: string; content: string; score: number }>,
  ) {
    // Dummy mastery & emotion injection.
    const masteryInfo = { level: 'intermediate', recentTopics: ['quantum mechanics'] };
    const emotionInfo = { currentMood: 'focused', stressLevel: 0.2 };
    const enriched = memories.map((m) => `(${m.id}) ${m.content}\n[mastery: ${masteryInfo.level}] [emotion: ${emotionInfo.currentMood}]`);
    return enriched.join('\n');
  }

  /**
   * Compress the assembled prompt to respect token limits.
   * This placeholder simply truncates the string; a real implementation would use
   * a summarisation model or token‑budgeting algorithm.
   */
  private async compressPrompt(enrichedContext: string, userInput: string): Promise<string> {
    const maxTokens = 2000; // example limit
    const prompt = `${enrichedContext}\nUser: ${userInput}`;
    // Very naive token estimation: 1 token ≈ 4 characters.
    const maxChars = maxTokens * 4;
    if (prompt.length > maxChars) {
      return prompt.slice(0, maxChars) + '\n... (truncated)';
    }
    return prompt;
  }
}
