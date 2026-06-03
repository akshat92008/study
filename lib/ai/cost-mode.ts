// lib/ai/cost-mode.ts
// Global AI cost mode configuration.
// Controls token budgets, provider routing, and paid-model gating
// across the entire Cognition OS AI pipeline.
//
// Default: ultra_cheap — the only safe default for private beta.

export type AiCostMode = 'ultra_cheap' | 'cheap' | 'balanced' | 'quality';

/**
 * Returns the current global AI cost mode from env.
 * Default: ultra_cheap — smallest prompts, fastest free providers.
 */
export function getAiCostMode(): AiCostMode {
  const raw = (process.env.AI_COST_MODE ?? 'ultra_cheap').toLowerCase().trim();
  if (raw === 'cheap') return 'cheap';
  if (raw === 'balanced') return 'balanced';
  if (raw === 'quality') return 'quality';
  return 'ultra_cheap';
}

/**
 * True only when ENABLE_PAID_AI_FALLBACK=true.
 * Default: false. OpenAI must never be called unless this is true.
 */
export function isPaidAiEnabled(): boolean {
  return process.env.ENABLE_PAID_AI_FALLBACK === 'true';
}

/**
 * True only when ENABLE_ANTHROPIC_AI=true.
 * Default: false. Anthropic must never be called unless this is true.
 */
export function isAnthropicAiEnabled(): boolean {
  return process.env.ENABLE_ANTHROPIC_AI === 'true';
}

/**
 * True only when ENABLE_GOOGLE_AI=true.
 * Default: false. Google/Gemini must never be called unless this is true
 * (or the task is vision/pdf with no other capable provider).
 */
export function isGoogleAiEnabled(): boolean {
  return process.env.ENABLE_GOOGLE_AI === 'true';
}

/**
 * Whether the DB-backed AI response cache is active.
 * Default: true in ultra_cheap/cheap, can be disabled for debugging.
 */
export function isAiResponseCacheEnabled(): boolean {
  const mode = getAiCostMode();
  if (process.env.ENABLE_AI_RESPONSE_CACHE === 'false') return false;
  // Cache is always-on in budget modes unless explicitly disabled
  return mode === 'ultra_cheap' || mode === 'cheap' || process.env.ENABLE_AI_RESPONSE_CACHE === 'true';
}

/**
 * Whether the rule-first responder is active.
 * Default: true. Disabling forces every query to the AI.
 */
export function isRuleFirstEnabled(): boolean {
  return process.env.ENABLE_RULE_FIRST_RESPONDER !== 'false';
}

/**
 * Max number of recent messages to include in a prompt.
 * Reads MAX_RECENT_MESSAGES env first, falls back to mode defaults.
 */
export function getMaxRecentMessages(): number {
  const envVal = Number(process.env.MAX_RECENT_MESSAGES);
  if (Number.isFinite(envVal) && envVal > 0) return Math.floor(envVal);

  const mode = getAiCostMode();
  switch (mode) {
    case 'ultra_cheap': return 3;
    case 'cheap':       return 5;
    case 'balanced':    return 8;
    case 'quality':     return 12;
  }
}

/**
 * Max number of RAG chunks to include in a prompt.
 * Reads MAX_RAG_CHUNKS env first, falls back to mode defaults.
 */
export function getMaxRagChunks(): number {
  const envVal = Number(process.env.MAX_RAG_CHUNKS);
  if (Number.isFinite(envVal) && envVal > 0) return Math.floor(envVal);

  const mode = getAiCostMode();
  switch (mode) {
    case 'ultra_cheap': return 1;
    case 'cheap':       return 2;
    case 'balanced':    return 3;
    case 'quality':     return 4;
  }
}

/**
 * Max sync MCQ count before we queue as a background document job.
 */
export function getMaxSyncMcqCount(): number {
  const envVal = Number(process.env.MAX_SYNC_MCQ_COUNT);
  if (Number.isFinite(envVal) && envVal > 0) return Math.floor(envVal);
  return getAiCostMode() === 'ultra_cheap' ? 5 : 10;
}

/**
 * Max sync flashcard count.
 */
export function getMaxSyncFlashcardCount(): number {
  const envVal = Number(process.env.MAX_SYNC_FLASHCARD_COUNT);
  if (Number.isFinite(envVal) && envVal > 0) return Math.floor(envVal);
  return getAiCostMode() === 'ultra_cheap' ? 10 : 15;
}

/**
 * Max sync mock test question count.
 * Anything over this is queued as a background document job.
 */
export function getMaxSyncMockTestQuestions(): number {
  const envVal = Number(process.env.MAX_SYNC_MOCK_TEST_QUESTIONS);
  if (Number.isFinite(envVal) && envVal > 0) return Math.floor(envVal);
  return 20;
}
