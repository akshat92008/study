// lib/ai/providers.ts
// Central registry of all free AI providers.
// Tracks health state per provider so the router can skip broken ones.
// Priority order: fastest/most generous free tier first, Google last.

export type ProviderName = 
  | 'cerebras'        // Fastest inference alive. 1M tokens/day free.
  | 'sambanova'       // Fast + free embeddings.
  | 'groq_compound'   // 14,400 req/day free. llama-3.3-70b.
  | 'groq_gemma'      // Same Groq key, different model slot.
  | 'together'        // Free tier models. Good quality.
  | 'openrouter'      // Free :free suffix models. Multiple model slots.
  | 'fireworks'       // Free credits. OpenAI-compatible.
  | 'deepinfra'       // Free tier. Has vision models.
  | 'novita'          // Free credits. llama-3.3-70b.
  | 'mistral'         // Free tier. mistral-small-latest is free.
  | 'huggingface'     // Slow but always free. Last text resort before Google.
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

export function getProviderConfig(name: ProviderName): ProviderConfig {
  const configs: Record<ProviderName, ProviderConfig> = {

    cerebras: {
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY,
      models: { quality: 'llama3.3-70b', fast: 'llama3.1-8b' },
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
        fast: 'Meta-Llama-3.1-8B-Instruct',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: true,
      embeddingModel: 'E5-Mistral-7B-Instruct',
      embeddingDimensions: 4096, // Truncated to 768 for pgvector
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
      models: { quality: 'gemma2-9b-it', fast: 'gemma2-9b-it' },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    together: {
      name: 'together',
      baseUrl: 'https://api.together.xyz/v1',
      apiKey: process.env.TOGETHER_API_KEY,
      models: {
        // These are the permanently free models on Together — no credit needed
        quality: 'meta-llama/Llama-3.3-70B-Instruct-Turbo-Free',
        fast: 'meta-llama/Llama-3.2-3B-Instruct-Turbo',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: true,
      embeddingModel: 'togethercomputer/m2-bert-80M-8k-retrieval',
      embeddingDimensions: 768,
      authHeader: 'bearer',
    },

    openrouter: {
      name: 'openrouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY,
      models: {
        // :free suffix = permanently free, no credits needed
        quality: 'meta-llama/llama-3.3-70b-instruct:free',
        fast: 'google/gemma-3-12b-it:free',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    fireworks: {
      name: 'fireworks',
      baseUrl: 'https://api.fireworks.ai/inference/v1',
      apiKey: process.env.FIREWORKS_API_KEY,
      models: {
        quality: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
        fast: 'accounts/fireworks/models/llama-v3p1-8b-instruct',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    deepinfra: {
      name: 'deepinfra',
      baseUrl: 'https://api.deepinfra.com/v1/openai',
      apiKey: process.env.DEEPINFRA_API_KEY,
      models: {
        quality: 'meta-llama/Meta-Llama-3.1-70B-Instruct',
        fast: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
      },
      supportsStreaming: true,
      supportsVision: true, // llama-3.2-11b-vision available
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    novita: {
      name: 'novita',
      baseUrl: 'https://api.novita.ai/v3/openai',
      apiKey: process.env.NOVITA_API_KEY,
      models: {
        quality: 'meta-llama/llama-3.3-70b-instruct',
        fast: 'meta-llama/llama-3.1-8b-instruct',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
      authHeader: 'bearer',
    },

    mistral: {
      name: 'mistral',
      baseUrl: 'https://api.mistral.ai/v1',
      apiKey: process.env.MISTRAL_API_KEY,
      models: {
        // mistral-small-latest is free on their free tier
        quality: 'mistral-small-latest',
        fast: 'open-mistral-7b',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: true,
      embeddingModel: 'mistral-embed',
      embeddingDimensions: 1024,
      authHeader: 'bearer',
    },

    huggingface: {
      name: 'huggingface',
      baseUrl: 'https://api-inference.huggingface.co/models',
      apiKey: process.env.HF_API_KEY,
      models: {
        quality: 'meta-llama/Meta-Llama-3.1-8B-Instruct',
        fast: 'microsoft/Phi-3.5-mini-instruct',
      },
      supportsStreaming: false, // HF inference API is not streaming
      supportsVision: false,
      supportsEmbeddings: true,
      embeddingModel: 'sentence-transformers/all-MiniLM-L6-v2',
      embeddingDimensions: 384,
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
      apiKey: process.env.GOOGLE_AI_KEY,
      models: { quality: 'gemini-2.0-flash', fast: 'gemini-2.0-flash' },
      supportsStreaming: true,
      supportsVision: true,
      supportsEmbeddings: true,
      embeddingModel: 'text-embedding-004',
      embeddingDimensions: 768,
    },
  };

  return configs[name];
}

// ─── PRIORITY QUEUES ──────────────────────────────────────────────────────────
// Order = preference. Router tries each in order, skips if down or no key.
// Google is ALWAYS last — it's the emergency net only.

export const TASK_PROVIDER_PRIORITY: Record<TaskType, ProviderName[]> = {

  chat: [
    'cerebras',      // Fastest. 1M tokens/day.
    'sambanova',     // Fast + free.
    'groq_compound', // Reliable. 14,400/day.
    'groq_gemma',    // Same key as groq, different model = second slot.
    'together',      // Free forever models.
    'openrouter',    // :free models. Good backup.
    'fireworks',     // Free credits.
    'deepinfra',     // Free tier.
    'novita',        // Free credits.
    'mistral',       // Free tier.
    'huggingface',   // Slow but never dies.
    'cloudflare',    // Free Workers AI.
    'google',        // LAST RESORT.
  ],

  stream: [
    'cerebras',
    'sambanova',
    'groq_compound',
    'groq_gemma',
    'together',
    'openrouter',
    'fireworks',
    'deepinfra',
    'novita',
    'mistral',
    'cloudflare',
    // huggingface excluded — no streaming support
    'google',
  ],

  json: [
    'groq_compound', // Most reliable structured output.
    'cerebras',
    'sambanova',
    'together',
    'openrouter',
    'fireworks',
    'deepinfra',
    'novita',
    'mistral',
    'groq_gemma',
    'cloudflare',
    'huggingface',
    'google',
  ],

  embedding: [
    'sambanova',   // Free E5-Mistral embeddings.
    'together',    // Free m2-bert embeddings.
    'mistral',     // mistral-embed free tier.
    'cloudflare',  // Free bge-base.
    'google',      // Last resort embedding.
  ],

  vision: [
    'deepinfra',   // llama-3.2-11b-vision free.
    'cloudflare',  // llama-3.2-11b-vision free.
    'google',      // gemini-2.0-flash vision — last resort.
  ],
};
