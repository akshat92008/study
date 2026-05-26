// lib/ai/providers.ts
// Central registry of all free AI providers.
// Tracks health state per provider so the router can skip broken ones.
// Priority order: fastest/most generous free tier first, Google last.

import { logger } from '@/lib/utils/logger';

export type ProviderName = 
  | 'cerebras'        // Fastest inference alive. 1M tokens/day free.
  | 'sambanova'       // Fast + free embeddings.
  | 'groq_compound'   // 14,400 req/day free. llama-3.3-70b.
  | 'groq_gemma'      // Same Groq key, different model slot.
  | 'cloudflare'      // Free Workers AI. Vision capable.
  | 'google';         // LAST RESORT ONLY. Use when everything else is down.

export type TaskType = 
  | 'chat'
  | 'json'
  | 'stream'
  | 'embedding'
  | 'vision';

interface ProviderHealth {
  isDown: boolean;
  cooldownUntil: number;
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

const healthMap = new Map<ProviderName, ProviderHealth>();

function getHealth(name: ProviderName): ProviderHealth {
  if (!healthMap.has(name)) {
    healthMap.set(name, {
      isDown: false,
      cooldownUntil: 0,
      consecutiveFailures: 0,
      totalRequests: 0,
      totalFailures: 0,
    });
  }
  return healthMap.get(name)!;
}

export function isProviderAvailable(name: ProviderName): boolean {
  const health = getHealth(name);
  if (!health.isDown) return true;
  if (Date.now() > health.cooldownUntil) {
    health.isDown = false;
    health.consecutiveFailures = 0;
    return true;
  }
  return false;
}

export function markProviderSuccess(name: ProviderName): void {
  const health = getHealth(name);
  health.isDown = false;
  health.consecutiveFailures = 0;
  health.totalRequests++;
}

export function markProviderFailure(name: ProviderName, errorCode: number): void {
  const health = getHealth(name);
  health.consecutiveFailures++;
  health.totalRequests++;
  health.totalFailures++;

  // Kept short intentionally — free tier 401s are almost always rate limits,
  // not dead keys. Long cooldowns cause the "all exhausted" cascade.
  const cooldownMs =
    errorCode === 429 ? 30_000 :
    errorCode === 401 ? 30_000 :
    errorCode === 503 ? 20_000 :
    15_000;

  // Cap multiplier at 2 to prevent 25-minute lockouts
  const multiplier = Math.min(health.consecutiveFailures, 2);
  health.cooldownUntil = Date.now() + (cooldownMs * multiplier);
  health.isDown = true;
}

export function getProviderStats(): Record<string, ProviderHealth> {
  const result: any = {};
  for (const [name, health] of healthMap.entries()) {
    result[name] = { ...health };
  }
  return result;
}

export interface ProviderConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  models: {
    quality: string;
    fast: string;
  };
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  embeddingModel?: string;
  embeddingDimensions?: number;
  // Some providers need a custom auth header format
  authHeader?: 'bearer' | 'hf-token';
}

export const REQUIRED_ENV_VARS: Record<ProviderName, string[]> = {
  cloudflare: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
  google: ['GOOGLE_AI_KEY', 'GEMINI_API_KEY'],
  // Add other providers if they require specific env vars
};

export function getProviderConfig(name: ProviderName): ProviderConfig | null {
  const configs: Record<ProviderName, ProviderConfig> = {
  const configs: Record<ProviderName, ProviderConfig> = {

    cerebras: {
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY,
      models: { quality: 'gpt-oss-120b', fast: 'llama3.1-8b' },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    sambanova: {
      name: 'sambanova',
      baseUrl: 'https://api.sambanova.ai/v1',
      apiKey: process.env.SAMBANOVA_API_KEY,
      models: {
        quality: 'Meta-Llama-3.3-70B-Instruct',
        fast: 'gemma-3-12b-it',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      // No embeddings for SambaNova, keep undefined
      embeddingModel: undefined,
      embeddingDimensions: undefined,
      authHeader: 'bearer',
    },

    groq_compound: {
      name: 'groq_compound',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      models: {
        quality: 'llama-3.3-70b-versatile',
        fast: 'llama-3.1-8b-instant',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    groq_gemma: {
      name: 'groq_gemma',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      models: { quality: 'llama-3.1-8b-instant', fast: 'llama-3.1-8b-instant' },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    cloudflare: {
      name: 'cloudflare',
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run`,
      apiKey: process.env.CF_API_TOKEN,
      models: {
        quality: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        fast: '@cf/meta/llama-3.1-8b-instruct',
      },
      supportsStreaming: true,
      supportsVision: true,
      supportsEmbeddings: true,
      embeddingModel: '@cf/baai/bge-base-en-v1.5',
      embeddingDimensions: 768,
    },

    google: {
      name: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: process.env.GOOGLE_AI_KEY || process.env.GEMINI_API_KEY,
      models: { quality: 'gemini-2.0-flash', fast: 'gemini-2.0-flash' },
      supportsStreaming: true,
      supportsVision: true,
      supportsEmbeddings: true,
      embeddingModel: 'text-embedding-004',
      embeddingDimensions: 768,
    },
  };

    const config = configs[name];
  const required = REQUIRED_ENV_VARS[name] || [];
  const missing = required.filter(v => !process.env[v]);
  if (missing.length) {
    logger.warn(`Missing env vars for ${name}: ${missing.join(', ')}`);
    return null;
  }
  return config;
}

}

// ─── PRIORITY QUEUES ──────────────────────────────────────────────────────────
// Order = preference. Router tries each in order, skips if down or no key.
// Google is ALWAYS last — it's the emergency net only.

export const TASK_PROVIDER_PRIORITY: Record<TaskType, ProviderName[]> = {

  chat: [
    'cerebras',      // Fastest. 1M tokens/day.
    'groq_compound', // Reliable. 14,400/day.
    'groq_gemma',    // Same key as groq, different model = second slot.
    'cloudflare',    // Free Workers AI.
    'sambanova',     // Fast + free, lower priority to avoid rate limits.
    'google',        // LAST RESORT.
  ],

  stream: [
    'cerebras',
    'groq_compound',
    'groq_gemma',
    'cloudflare',
    'sambanova', // Lower priority for streaming.
    'google',
  ],

  json: [
    'groq_compound', // Most reliable structured output.
    'cerebras',
    'sambanova',
    'groq_gemma',
    'cloudflare',
    'google',
  ],

  embedding: [
    'cloudflare',  // Free bge-base.
    'google',      // Last resort embedding.
  ],

  vision: [
    'cloudflare',  // llama-3.2-11b-vision free.
    'google',      // gemini-2.0-flash vision — last resort.
  ],
};
