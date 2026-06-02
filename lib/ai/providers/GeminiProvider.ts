// lib/ai/providers/GeminiProvider.ts

import { LLMProvider, LLMMessage } from '@/lib/ai/providers/LLMProvider';
import { budgetedGenerateJSON, budgetedStreamGeneration } from '@/lib/ai/budgeted';
import { ProviderCapabilities } from '@/lib/ai/providers/LLMProvider';
import { tracer, meter } from '@/lib/telemetry/otel';
import type { Counter } from '@opentelemetry/api';

/**
 * GeminiProvider implements the generic LLMProvider interface using the
 * existing Gemini helper functions (`generateJSON` and `streamText`).
 *
 * It abstracts Gemini‑specific details so the rest of the codebase can work
 * against the provider‑agnostic `LLMProvider` contract.
 */
export class GeminiProvider implements LLMProvider {
  capabilities: ProviderCapabilities = {
    supportsStreaming: true,
    supportsVision: true,
    supportsTools: true,
    supportsAudio: false,
    maxContextTokens: 120_000, // Gemini 1.5 max context
  };

  // Metrics
  private requestCounter: Counter = meter.createCounter('gemini_requests_total', {
    description: 'Total number of Gemini generate calls',
  });
  private errorCounter: Counter = meter.createCounter('gemini_errors_total', {
    description: 'Total number of Gemini errors',
  });
  private tokenCounter: Counter = meter.createCounter('gemini_tokens_used', {
    description: 'Number of tokens used in Gemini calls',
  });

  /**
   * Generate a full response from Gemini.
   * The `options` object mirrors the generic interface but forwarding
   * maxTokens and temperature is omitted for simplicity in underlying mapping.
   */
  async generate(
    messages: LLMMessage[],
    options?: { userId?: string; maxTokens?: number; temperature?: number; streaming?: boolean }
  ): Promise<string> {
    if (!options?.userId) {
      throw new Error('GeminiProvider.generate requires userId for AI budget enforcement.');
    }
    const modelKey = options?.streaming ? 'flash' : 'pro';
    const span = tracer.startSpan('gemini.generate', {
      attributes: {
        'llm.provider': 'gemini',
         'llm.model': modelKey === 'flash' ? 'gemini-2.0-flash' : 'gemini-1.5-pro',
        'llm.prompt_length': JSON.stringify(messages).length,
      },
    });
    try {
      const prompt = JSON.stringify(messages);
      const response = await budgetedGenerateJSON<string>({
        userId: options.userId,
        feature: 'chat',
        route: 'gemini-provider:generate',
        model: modelKey,
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: prompt,
        maxOutputTokens: options?.maxTokens ?? 1024,
      });
      // Record metrics
       this.requestCounter.add(1, { model: modelKey === 'flash' ? 'gemini-2.0-flash' : 'gemini-1.5-pro' });
      // Approximate token usage (1 token ≈ 4 chars)
      const inputTokens = Math.ceil(prompt.length / 4);
      const outputTokens = Math.ceil(response.length / 4);
       this.tokenCounter.add(inputTokens + outputTokens, { model: modelKey === 'flash' ? 'gemini-2.0-flash' : 'gemini-1.5-pro' });
      span.setAttribute('llm.tokens_input', inputTokens);
      span.setAttribute('llm.tokens_output', outputTokens);
      span.end();
      return response;
    } catch (err: any) {
      this.errorCounter.add(1);
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message }); // 2 = ERROR
      span.end();
      throw err;
    }
  }

  /**
   * Stream a response from Gemini token‑by‑token (or chunk).
   */
  async *stream(
    messages: LLMMessage[],
    options?: { userId?: string; maxTokens?: number; temperature?: number }
  ): AsyncIterable<string> {
    if (!options?.userId) {
      throw new Error('GeminiProvider.stream requires userId for AI budget enforcement.');
    }
     const span = tracer.startSpan('gemini.stream', {
       attributes: {
         'llm.provider': 'gemini',
         'llm.model': 'gemini-2.0-flash',
         'llm.prompt_length': JSON.stringify(messages).length,
       },
     });
    try {
      const prompt = JSON.stringify(messages);
      const generator = await budgetedStreamGeneration({
        userId: options.userId,
        feature: 'chat',
        route: 'gemini-provider:stream',
        model: 'flash',
        systemPrompt: 'You are a helpful assistant.',
        userPrompt: prompt,
        maxOutputTokens: options?.maxTokens ?? 1200,
      });
      for await (const chunk of generator) {
        // Record token metric per chunk (approximate)
        const tokenEstimate = Math.ceil(chunk.length / 4);
        this.tokenCounter.add(tokenEstimate, { model: 'gemini-2.0-flash' });
        span.addEvent('chunk', { 'chunk.length': chunk.length });
        yield chunk;
      }
      span.end();
    } catch (err: any) {
      this.errorCounter.add(1);
      span.recordException(err);
      span.setStatus({ code: 2, message: err.message });
      span.end();
      throw err;
    }
  }
}
