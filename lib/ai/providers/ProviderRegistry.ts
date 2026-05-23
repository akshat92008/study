// lib/ai/providers/ProviderRegistry.ts

import { GeminiProvider } from '@/lib/ai/providers/GeminiProvider';
import { LLMProvider } from '@/lib/ai/providers/LLMProvider';

/**
 * Simple factory that returns the default LLM provider.
 * Currently this is Gemini, but the function can be expanded to
 * select providers based on configuration or runtime flags.
 */
export function getDefaultProvider(): LLMProvider {
  return new GeminiProvider();
}
