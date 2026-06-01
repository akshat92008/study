// lib/ai/providers/ProviderRegistry.ts

import { GeminiProvider } from '@/lib/ai/providers/GeminiProvider';
import { LLMProvider } from '@/lib/ai/providers/LLMProvider';

/**
 * ProviderRegistry offers a getDefault() method returning the default LLM provider.
 * This matches the usage pattern in client.ts.
 */
export const ProviderRegistry = {
  getDefault(): LLMProvider {
    return new GeminiProvider();
  },
  // Future providers can be added here.
};

export function getDefaultProvider(): LLMProvider {
  return ProviderRegistry.getDefault();
}
