// lib/ai/provider-token-caps.ts
// Per-provider input token caps per task.
//
// Purpose:
//   Before every provider call, check if the prompt would exceed that provider's
//   practical limit. If it would, SKIP the provider (log SKIPPED_TOKEN_BUDGET)
//   instead of calling it and getting a 413 or TPM error.
//
//   This prevents:
//   - 413 Request Too Large
//   - TPM quota explosions on free tier
//   - Fallback cascade storms (where every provider gets the same oversized prompt)
//
// Skip reasons are logged as 'SKIPPED_TOKEN_BUDGET' — not counted as failures.
// The provider's cooldown timer is NOT incremented for a token-skip.

import { getAiCostMode, type AiCostMode } from './cost-mode';
import type { ProviderName } from './providers';
import type { AiTask } from './token-budget';
import { logger } from '@/lib/utils/logger';

// ─── CAPS TABLE ───────────────────────────────────────────────────────────────
// Values are maximum INPUT tokens the provider can reliably handle per task.
// Exceed these and the provider will reject or degrade the response.

type CapsTable = Partial<Record<AiTask, number>>;

const ULTRA_CHEAP_CAPS: Record<ProviderName, CapsTable> = {
  nvidia: {
    chat: 5000,
    tutor: 6000,
    stream: 5000,
    json: 4500,
    document_generation: 5000,
    autopsy: 7000,
    flashcards: 5000,
    formula_sheet: 4500,
    classification: 1500,
    vision: 5000,
    embedding: 700,
    pdf: 8000,
  },
  nvidia_router: {
    chat: 5000,
    tutor: 6000,
    stream: 5000,
    json: 4500,
    document_generation: 5000,
    autopsy: 7000,
    flashcards: 5000,
    formula_sheet: 4500,
    classification: 1500,
  },
  cerebras: {
    chat: 3200,
    tutor: 3500,
    stream: 3200,
    json: 3000,
    document_generation: 3500,
    autopsy: 3500,
    flashcards: 3500,
    formula_sheet: 3000,
    classification: 800,
    embedding: 700,
  },
  cerebras_fallback: {
    chat: 3200,
    tutor: 3500,
    stream: 3200,
    json: 3000,
    document_generation: 3500,
    autopsy: 3500,
    flashcards: 3500,
    formula_sheet: 3000,
    classification: 800,
    embedding: 700,
  },
  sambanova: {
    chat: 3200,
    tutor: 3500,
    stream: 3200,
    json: 3000,
    document_generation: 3500,
    flashcards: 3500,
    formula_sheet: 3000,
    classification: 800,
  },
  groq_compound: {
    chat: 2500,
    tutor: 2800,
    stream: 2500,
    json: 2200,
    document_generation: 2500,
    autopsy: 2500,
    flashcards: 2500,
    formula_sheet: 2200,
    classification: 600,
    vision: 3000,
  },
  groq_gemma: {
    chat: 1800,
    tutor: 2200,
    stream: 1800,
    json: 1800,
    classification: 600,
    flashcards: 2000,
    formula_sheet: 1800,
  },
  cloudflare: {
    classification: 600,
    embedding: 700,
    chat: 1800,
    stream: 1800,
    vision: 2000,
  },
  // google and openai are gated by env flags — they have large caps
  // but should never be called unless explicitly enabled
  google: {
    chat: 50000,
    tutor: 50000,
    stream: 50000,
    json: 50000,
    document_generation: 50000,
    autopsy: 50000,
    flashcards: 50000,
    formula_sheet: 50000,
    classification: 10000,
    vision: 50000,
    embedding: 2000,
    pdf: 100000,
  },
  openai: {
    chat: 50000,
    tutor: 50000,
    stream: 50000,
    json: 50000,
    document_generation: 50000,
    autopsy: 50000,
    flashcards: 50000,
    formula_sheet: 50000,
    classification: 10000,
    vision: 50000,
    embedding: 8000,
  },
  anthropic: {
    chat: 50000,
    tutor: 50000,
    stream: 50000,
    json: 50000,
    document_generation: 50000,
    autopsy: 50000,
    flashcards: 50000,
    formula_sheet: 50000,
    classification: 10000,
    vision: 50000,
    pdf: 100000,
  },
};

// For cheap/balanced/quality modes, caps are more generous
const CHEAP_CAPS: Record<ProviderName, CapsTable> = {
  nvidia:           { ...ULTRA_CHEAP_CAPS.nvidia,          chat: 8000,  tutor: 9000,  json: 7000, autopsy: 10000 },
  nvidia_router:    { ...ULTRA_CHEAP_CAPS.nvidia_router,   chat: 8000,  tutor: 9000,  json: 7000, autopsy: 10000 },
  cerebras:         { ...ULTRA_CHEAP_CAPS.cerebras,        chat: 5000,  tutor: 6000,  json: 5000 },
  cerebras_fallback:{ ...ULTRA_CHEAP_CAPS.cerebras_fallback, chat: 5000, tutor: 6000, json: 5000 },
  sambanova:        { ...ULTRA_CHEAP_CAPS.sambanova,       chat: 5000,  tutor: 6000,  json: 5000 },
  groq_compound:    { ...ULTRA_CHEAP_CAPS.groq_compound,   chat: 4000,  tutor: 5000,  json: 3500 },
  groq_gemma:       { ...ULTRA_CHEAP_CAPS.groq_gemma,      chat: 3000,  tutor: 3500,  json: 3000 },
  cloudflare:       { ...ULTRA_CHEAP_CAPS.cloudflare,      chat: 3000 },
  google:           { ...ULTRA_CHEAP_CAPS.google },
  openai:           { ...ULTRA_CHEAP_CAPS.openai },
  anthropic:        { ...ULTRA_CHEAP_CAPS.anthropic },
};

// balanced and quality use provider's actual limits (very generous)
const UNLIMITED_CAP = 999999;
const HIGH_CAPS: CapsTable = {
  chat: UNLIMITED_CAP,
  tutor: UNLIMITED_CAP,
  stream: UNLIMITED_CAP,
  json: UNLIMITED_CAP,
  document_generation: UNLIMITED_CAP,
  autopsy: UNLIMITED_CAP,
  flashcards: UNLIMITED_CAP,
  formula_sheet: UNLIMITED_CAP,
  classification: UNLIMITED_CAP,
  vision: UNLIMITED_CAP,
  embedding: UNLIMITED_CAP,
  pdf: UNLIMITED_CAP,
};

const BALANCED_QUALITY_CAPS: Record<ProviderName, CapsTable> = {
  nvidia:            HIGH_CAPS,
  nvidia_router:     HIGH_CAPS,
  cerebras:          HIGH_CAPS,
  cerebras_fallback: HIGH_CAPS,
  sambanova:         HIGH_CAPS,
  groq_compound:     HIGH_CAPS,
  groq_gemma:        HIGH_CAPS,
  cloudflare:        HIGH_CAPS,
  google:            HIGH_CAPS,
  openai:            HIGH_CAPS,
  anthropic:         HIGH_CAPS,
};

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Get the max input tokens a provider can handle for a given task.
 */
export function getProviderCap(
  provider: ProviderName,
  task: AiTask,
  mode?: AiCostMode
): number {
  const costMode = mode ?? getAiCostMode();
  let capsTable: Record<ProviderName, CapsTable>;
  switch (costMode) {
    case 'ultra_cheap': capsTable = ULTRA_CHEAP_CAPS; break;
    case 'cheap':       capsTable = CHEAP_CAPS; break;
    default:            capsTable = BALANCED_QUALITY_CAPS; break;
  }
  return capsTable[provider]?.[task] ?? UNLIMITED_CAP;
}

/**
 * Returns true if the estimated token count would exceed this provider's cap
 * for the given task.
 *
 * When this returns true, the caller should:
 *   - Skip the provider (log SKIPPED_TOKEN_BUDGET)
 *   - NOT record a health failure
 *   - Continue to the next provider
 */
export function willExceedProviderCap(
  provider: ProviderName,
  task: AiTask,
  estimatedInputTokens: number,
  mode?: AiCostMode
): boolean {
  const cap = getProviderCap(provider, task, mode);
  return estimatedInputTokens > cap;
}

/**
 * Log a SKIPPED_TOKEN_BUDGET event (not a health failure).
 */
export function logTokenSkip(
  provider: ProviderName,
  task: AiTask,
  estimatedTokens: number,
  cap: number
): void {
  logger.info(`[Router] SKIPPED_TOKEN_BUDGET: ${provider} for ${task}`, {
    estimatedTokens,
    cap,
    overflow: estimatedTokens - cap,
    reason: 'SKIPPED_TOKEN_BUDGET',
  });
}
