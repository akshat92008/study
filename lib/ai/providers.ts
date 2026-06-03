import { logger } from '@/lib/utils/logger';

export type ProviderName =
  | 'cerebras'        // Fastest inference alive. 1M tokens/day free.
  | 'cerebras_fallback' // Second Cerebras key.
  | 'sambanova'       // Fast + free inference.
  | 'groq_compound'   // 14,400 req/day free. llama-3.3-70b.
  | 'groq_gemma'      // Same Groq key, different model slot.
  | 'cloudflare'      // Free Workers AI. Vision capable.
  | 'google'          // LAST RESORT ONLY. Use when everything else is down.
  | 'openai'          // PAID FALLBACK
  | 'nvidia';         // NVIDIA NIM provider

export type TaskType = 
  | 'chat'
  | 'json'
  | 'stream'
  | 'embedding'
  | 'vision'
  | 'pdf'
  | 'classification'
  | 'autopsy'
  | 'tutor'
  | 'audio';

export interface ProviderCapabilities {
  supportsText: boolean;
  supportsStreaming: boolean;
  supportsJson: boolean;
  supportsVision: boolean;
  supportsPdf: boolean;
  supportsEmbeddings: boolean;
  supportsAudio: boolean;
  maxInputBytes?: number;
  maxInputTokens?: number;
  costTier?: 'free' | 'metered' | 'paid';
  cooldownMs?: number;
}


export interface ProviderConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  models: {
    quality: string;
    fast: string;
  };
  capabilities: ProviderCapabilities;
  supportsText: boolean;
  supportsStreaming: boolean;
  supportsJson: boolean;
  supportsVision: boolean;
  supportsPdf: boolean;
  supportsEmbeddings: boolean;
  supportsAudio: boolean;
  maxInputBytes?: number;
  maxInputTokens?: number;
  costTier?: 'free' | 'metered' | 'paid';
  cooldownMs?: number;
  embeddingModel?: string;
  embeddingDimensions?: number;
  // Some providers need a custom auth header format
  authHeader?: 'bearer' | 'hf-token';
}

function capabilities(input: Partial<ProviderCapabilities>): ProviderCapabilities {
  return {
    supportsText: input.supportsText ?? true,
    supportsStreaming: input.supportsStreaming ?? false,
    supportsJson: input.supportsJson ?? true,
    supportsVision: input.supportsVision ?? false,
    supportsPdf: input.supportsPdf ?? false,
    supportsEmbeddings: input.supportsEmbeddings ?? false,
    supportsAudio: input.supportsAudio ?? false,
    maxInputBytes: input.maxInputBytes,
    maxInputTokens: input.maxInputTokens,
    costTier: input.costTier ?? 'free',
    cooldownMs: input.cooldownMs ?? 15_000,
  };
}

export const REQUIRED_ENV_VARS: Record<ProviderName, string[]> = {
  cloudflare: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
  google: ['GEMINI_API_KEY'],
  cerebras: [], // No specific env vars
  cerebras_fallback: [],
  sambanova: [], // No specific env vars
  groq_compound: [], // No specific env vars
  groq_gemma: [], // No specific env vars
  openai: ['OPENAI_API_KEY'],
  nvidia: ['NVIDIA_API_KEY'],
};


export function getProviderConfig(name: ProviderName): ProviderConfig | null {
  const configs: Record<ProviderName, ProviderConfig> = {


    cerebras: {
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY,
      models: { quality: 'llama-3.3-70b', fast: 'llama3.1-8b' },
      capabilities: capabilities({
        supportsStreaming: true,
        maxInputTokens: 8192,
        costTier: 'free',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: false,
      supportsPdf: false,
      supportsEmbeddings: false,
      supportsAudio: false,
      maxInputTokens: 8192,
      costTier: 'free',
      authHeader: 'bearer',
    },

    cerebras_fallback: {
      name: 'cerebras_fallback',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY_2 || process.env.CEREBRAS_API_KEY,
      models: { quality: 'llama-3.3-70b', fast: 'llama3.1-8b' },
      capabilities: capabilities({
        supportsStreaming: true,
        maxInputTokens: 8192,
        costTier: 'free',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: false,
      supportsPdf: false,
      supportsEmbeddings: false,
      supportsAudio: false,
      maxInputTokens: 8192,
      costTier: 'free',
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
      capabilities: capabilities({
        supportsStreaming: true,
        maxInputTokens: 8192,
        costTier: 'free',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: false,
      supportsPdf: false,
      supportsEmbeddings: false,
      supportsAudio: false,
      maxInputTokens: 8192,
      costTier: 'free',
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
      capabilities: capabilities({
        supportsStreaming: true,
        supportsVision: true,
        maxInputTokens: 8192,
        costTier: 'free',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: true,
      supportsPdf: false,
      supportsEmbeddings: false,
      supportsAudio: false,
      maxInputTokens: 8192,
      costTier: 'free',
      authHeader: 'bearer',
    },

    groq_gemma: {
      name: 'groq_gemma',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY_2 || process.env.GROQ_API_KEY,
      models: { quality: 'llama-3.1-8b-instant', fast: 'llama-3.1-8b-instant' },
      capabilities: capabilities({
        supportsStreaming: true,
        maxInputTokens: 8192,
        costTier: 'free',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: false,
      supportsPdf: false,
      supportsEmbeddings: false,
      supportsAudio: false,
      maxInputTokens: 8192,
      costTier: 'free',
      authHeader: 'bearer',
    },

    cloudflare: {
      name: 'cloudflare',
      baseUrl: `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID}/ai/run`,
      apiKey: process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN,
      models: {
        quality: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        fast: '@cf/meta/llama-3.1-8b-instruct',
      },
      capabilities: capabilities({
        supportsStreaming: true,
        supportsVision: true,
        supportsEmbeddings: true,
        maxInputTokens: 8192,
        costTier: 'free',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: true,
      supportsPdf: false,
      supportsEmbeddings: true,
      supportsAudio: false,
      maxInputTokens: 8192,
      costTier: 'free',
      embeddingModel: '@cf/baai/bge-base-en-v1.5',
      embeddingDimensions: 768,
    },

    google: {
      name: 'google',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
      apiKey: process.env.GEMINI_API_KEY,
      models: { quality: 'gemini-2.0-flash', fast: 'gemini-2.0-flash' },
      capabilities: capabilities({
        supportsStreaming: true,
        supportsVision: true,
        supportsPdf: true,
        supportsEmbeddings: true,
        supportsAudio: true,
        maxInputBytes: 20 * 1024 * 1024,
        maxInputTokens: 1_000_000,
        costTier: 'metered',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: true,
      supportsPdf: true,
      supportsEmbeddings: true,
      supportsAudio: true,
      maxInputBytes: 20 * 1024 * 1024,
      maxInputTokens: 1_000_000,
      costTier: 'metered',
      embeddingModel: 'text-embedding-004',
      embeddingDimensions: 768,
    },

    openai: {
      name: 'openai',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: process.env.OPENAI_API_KEY,
      models: { quality: 'gpt-4o-mini', fast: 'gpt-4o-mini' },
      capabilities: capabilities({
        supportsStreaming: true,
        supportsVision: true,
        supportsEmbeddings: true,
        maxInputTokens: 128_000,
        costTier: 'paid',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: true,
      supportsPdf: false,
      supportsEmbeddings: true,
      supportsAudio: false,
      maxInputTokens: 128_000,
      costTier: 'paid',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimensions: 768,
      authHeader: 'bearer',
    },
      nvidia: {
      name: 'nvidia',
      baseUrl: 'https://integrate.api.nvidia.com/v1',
      apiKey: process.env.NVIDIA_API_KEY_2 || process.env.NVIDIA_API_KEY,
      models: {
        quality: 'meta/llama-3.3-70b-instruct', // best reasoning model
        fast: 'meta/llama-3.1-8b-instruct',   // faster, cheaper
      },
      capabilities: capabilities({
        supportsVision: true,
        supportsPdf: true,
        supportsEmbeddings: true,
        maxInputBytes: 20 * 1024 * 1024,
        maxInputTokens: 1_000_000,
        costTier: 'metered',
      }),
      supportsText: true,
      supportsStreaming: true,
      supportsJson: true,
      supportsVision: true,
      supportsPdf: true,
      supportsEmbeddings: true,
      supportsAudio: false,
      maxInputBytes: 20 * 1024 * 1024,
      maxInputTokens: 1_000_000,
      costTier: 'metered',
      embeddingModel: 'nvidia/nv-embedqa-e5-v5',
      embeddingDimensions: 1024,
      authHeader: 'bearer',
    },
};

    const config = configs[name];
  const required = REQUIRED_ENV_VARS[name] || [];
  
  // Special handling for Cloudflare aliases
  if (name === 'cloudflare') {
    const hasAccountId = process.env.CF_ACCOUNT_ID || process.env.CLOUDFLARE_ACCOUNT_ID;
    const hasToken = process.env.CF_API_TOKEN || process.env.CLOUDFLARE_API_TOKEN;
    if (!hasAccountId || !hasToken) {
      logger.warn(`Missing env vars for cloudflare: requires (CF_ACCOUNT_ID or CLOUDFLARE_ACCOUNT_ID) and (CF_API_TOKEN or CLOUDFLARE_API_TOKEN)`);
      return null;
    }
  } else {
    const missing = required.filter(v => !process.env[v]);
    if (missing.length) {
      logger.warn(`Missing env vars for ${name}: ${missing.join(', ')}`);
      return null;
    }
  }
  return config;
}



// ─── PRIORITY QUEUES ──────────────────────────────────────────────────────────
// Order = preference. Router tries each in order, skips if down or no key.
// Google is ALWAYS last — it's the emergency net only.

export const TASK_PROVIDER_PRIORITY: Record<TaskType, ProviderName[]> = {

  chat: [
    'cerebras',      // Fastest. 1M tokens/day.
    'cerebras_fallback',
    'groq_compound', // Reliable. 14,400/day.
    'groq_gemma',    // Same key as groq, different model = second slot.
    'cloudflare',    // Free Workers AI.
    'sambanova',     // Fast + free, lower priority to avoid rate limits.
    'google',        // LAST RESORT.
    'openai',        // PAID FALLBACK
  ],

  tutor: [
    'cerebras',
    'cerebras_fallback',
    'groq_compound',
    'groq_gemma',
    'cloudflare',
    'sambanova',
    'google',
    'openai',
  ],

  stream: [
    'cerebras',
    'cerebras_fallback',
    'groq_compound',
    'groq_gemma',
    'cloudflare',
    'sambanova', // Lower priority for streaming.
    'google',
    'openai',
  ],

  json: [
    'groq_compound', // Most reliable structured output.
    'cerebras',
    'cerebras_fallback',
    'sambanova',
    'groq_gemma',
    'cloudflare',
    'google',
    'openai',
  ],

  classification: [
    'groq_compound',
    'cerebras',
    'cerebras_fallback',
    'sambanova',
    'groq_gemma',
    'cloudflare',
    'google',
    'openai',
  ],

  autopsy: [
    'nvidia',
    'groq_compound',
    'cloudflare',
    'google',
    'openai',
  ],

  embedding: [
    'cloudflare',  // Free bge-base.
    'google',      // Last resort embedding.
    'openai',
  ],

  vision: [
    'groq_compound', // Fast and reliable vision model
    'cloudflare',  // llama-3.2-11b-vision free.
    'google',      // gemini-2.0-flash vision — last resort.
    'openai',
  ],

  pdf: [
    'google',
    'nvidia',
    'openai',
  ],

  audio: [
    'google',
  ],
};
