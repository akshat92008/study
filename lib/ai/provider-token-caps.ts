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
    chat: 6500,
    tutor: 6500,
    stream: 6500,
    json: 6500,
    document_generation: 6500,
    autopsy: 6500,
    flashcards: 6500,
    formula_sheet: 6500,
    classification: 1500,
    embedding: 700,
  },
  cerebras_fallback: {
    chat: 6500,
    tutor: 6500,
    stream: 6500,
    json: 6500,
    document_generation: 6500,
    autopsy: 6500,
    flashcards: 6500,
    formula_sheet: 6500,
    classification: 1500,
    embedding: 700,
  },
  sambanova: {
    chat: 6500,
    tutor: 6500,
    stream: 6500,
    json: 6500,
    document_generation: 6500,
    flashcards: 6500,
    formula_sheet: 6500,
    classification: 1500,
  },
  groq_compound: {
    chat: 6500,
    tutor: 6500,
    stream: 6500,
    json: 6000,
    document_generation: 6500,
    autopsy: 6500,
    flashcards: 6500,
    formula_sheet: 6000,
    classification: 1500,
    vision: 4000,
  },
  groq_gemma: {
    chat: 4000,
    tutor: 4000,
    stream: 4000,
    json: 4000,
    classification: 1500,
    flashcards: 4000,
    formula_sheet: 4000,
  },
  cloudflare: {
    classification: 1500,
    embedding: 700,
    chat: 5000,
    stream: 5000,
    vision: 3000,
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
  cerebras:         { ...ULTRA_CHEAP_CAPS.cerebras,        chat: 7500,  tutor: 7500,  json: 7000, stream: 7500 },
  cerebras_fallback:{ ...ULTRA_CHEAP_CAPS.cerebras_fallback, chat: 7500, tutor: 7500, json: 7000, stream: 7500 },
  sambanova:        { ...ULTRA_CHEAP_CAPS.sambanova,       chat: 7500,  tutor: 7500,  json: 7000, stream: 7500 },
  groq_compound:    { ...ULTRA_CHEAP_CAPS.groq_compound,   chat: 7000,  tutor: 7000,  json: 6500, stream: 7000 },
  groq_gemma:       { ...ULTRA_CHEAP_CAPS.groq_gemma,      chat: 5000,  tutor: 5000,  json: 5000, stream: 5000 },
  cloudflare:       { ...ULTRA_CHEAP_CAPS.cloudflare,      chat: 6000, stream: 6000 },
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
