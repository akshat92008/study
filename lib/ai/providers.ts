// lib/ai/providers.ts
// Central registry of all free AI providers.
// Tracks health state per provider so the router can skip broken ones.

export type ProviderName = 
  | 'cerebras' 
  | 'sambanova' 
  | 'groq_compound' 
  | 'groq_gemma' 
  | 'cloudflare'
  | 'google';

export type TaskType = 
  | 'chat'        // Main tutor/conversation — needs quality
  | 'json'        // Structured output — needs reliability  
  | 'stream'      // Streaming tutor response — needs speed
  | 'embedding'   // Vector embedding — dedicated providers
  | 'vision';     // Image analysis — multimodal providers

interface ProviderHealth {
  isDown: boolean;
  cooldownUntil: number; // timestamp
  consecutiveFailures: number;
  totalRequests: number;
  totalFailures: number;
}

// In-memory health state — resets on cold start which is fine
// A cold start means the provider gets a fresh chance
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
  // Check if cooldown has expired
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

export function markProviderFailure(
  name: ProviderName, 
  errorCode: number
): void {
  const health = getHealth(name);
  health.consecutiveFailures++;
  health.totalRequests++;
  health.totalFailures++;

  // 429 = rate limit: cool down for 60 seconds
  // 401 = auth error: cool down for 5 minutes (may be transient)
  // 500 = server error: cool down for 30 seconds
  // 503 = overloaded: cool down for 45 seconds
  const cooldownMs = 
    errorCode === 429 ? 60_000 :
    errorCode === 401 ? 300_000 :
    errorCode === 503 ? 45_000 :
    30_000;

  // Exponential backoff on consecutive failures
  const multiplier = Math.min(health.consecutiveFailures, 5);
  health.cooldownUntil = Date.now() + (cooldownMs * multiplier);
  health.isDown = true;
}

export function getProviderStats(): Record<ProviderName, ProviderHealth> {
  const result: any = {};
  for (const [name, health] of healthMap.entries()) {
    result[name] = { ...health };
  }
  return result;
}

// Provider configurations
export interface ProviderConfig {
  name: ProviderName;
  baseUrl: string;
  apiKey: string | undefined;
  models: {
    quality: string;  // Best model for complex tasks
    fast: string;     // Fastest model for simple tasks
  };
  supportsStreaming: boolean;
  supportsVision: boolean;
  supportsEmbeddings: boolean;
  embeddingModel?: string;
  embeddingDimensions?: number;
}

export function getProviderConfig(name: ProviderName): ProviderConfig {
  const configs: Record<ProviderName, ProviderConfig> = {
    cerebras: {
      name: 'cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY,
      models: {
        quality: 'llama-3.3-70b',
        fast: 'llama3.1-8b',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
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
      embeddingDimensions: 4096, // Will be truncated to 768 for pgvector
    },
    groq_compound: {
      name: 'groq_compound',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      models: {
        quality: 'compound-beta',
        fast: 'compound-beta-mini',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
    },
    groq_gemma: {
      name: 'groq_gemma',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY,
      models: {
        quality: 'gemma2-9b-it',
        fast: 'gemma2-9b-it',
      },
      supportsStreaming: true,
      supportsVision: false,
      supportsEmbeddings: false,
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
      models: {
        quality: 'gemini-2.0-flash',
        fast: 'gemini-2.0-flash',
      },
      supportsStreaming: true,
      supportsVision: true,
      supportsEmbeddings: true,
      embeddingModel: 'text-embedding-004',
      embeddingDimensions: 768,
    },
  };
  return configs[name];
}

// Priority queues per task type
// Order = preference. Router tries each in order, skips if down.
export const TASK_PROVIDER_PRIORITY: Record<TaskType, ProviderName[]> = {
  // Chat/stream: Cerebras first (fastest + 1M/day), 
  // then SambaNova, then Groq compound, then Groq gemma
  chat: ['cerebras', 'sambanova', 'groq_compound', 'groq_gemma', 'google'],
  stream: ['cerebras', 'sambanova', 'groq_compound', 'groq_gemma', 'google'],
  
  // JSON: SambaNova first (most reliable structured output),
  // then Cerebras, then Groq
  json: ['sambanova', 'cerebras', 'groq_compound', 'groq_gemma', 'google'],
  
  // Embeddings: SambaNova has free embedding model,
  // Cloudflare as backup, Google as last resort
  embedding: ['sambanova', 'cloudflare', 'google'],
  
  // Vision: Cloudflare has vision model free,
  // Google Gemini also supports vision
  vision: ['cloudflare', 'google'],
};
