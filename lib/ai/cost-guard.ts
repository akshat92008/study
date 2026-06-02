// lib/ai/cost-guard.ts
// Atomic AI budget reservation, commit, and release.
// All paid/metered LLM calls MUST go through this wrapper.
//
// Architecture:
//   1. reserveBudgetForModelCall()  → DB atomic lock + reserve cost
//   2. [call LLM]
//   3a. commitBudgetUsage()         → record actual cost, release reserve
//   3b. releaseBudgetReservation()  → on failure, release reserve
//
// The DB function reserve_ai_budget() uses SELECT ... FOR UPDATE on
// ai_usage_daily, so concurrent requests cannot both read "within budget"
// and both proceed. This eliminates the TOCTOU race in the old check-then-call
// pattern.
//
// Failure behaviour:
//   - If the DB RPC is unavailable, fail CLOSED for public routes
//     (throws BudgetSystemUnavailableError).
//   - Free/local model calls may pass requireBudget: false with a comment.

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { NextResponse } from 'next/server';
import { consumeUsageLimit } from '@/lib/utils/billing';

// ─── TYPES ───────────────────────────────────────────────────────────────────

export type BudgetFeature =
  | 'chat'
  | 'chat_vision'
  | 'chat_document_vision'
  | 'autopsy'
  | 'image'
  | 'planner'
  | 'session-card'
  | 'tutor'
  | 'embedding'
  | 'memory-scoring'
  | 'intent-classification'
  | 'emotional-state'
  | 'session-analysis'
  | 'welcome'
  | 'revision-coach'
  | 'negotiate'
  | 'knowledge-guide'
  | 'knowledge-audio'
  | 'analyze'
  | 'atlas'
  | 'onboarding'
  | 'chat-mentor'
  | 'rag_flashcard';

export interface BudgetReservation {
  reservationId: string;
  estimatedCost: number;
  estimatedTokens: number;
}

export interface ActualUsage {
  promptTokens: number;
  completionTokens: number;
  actualCost?: number;
  route?: string;
  promptVersion?: string | null;
  promptFamily?: string | null;
  promptSource?: string | null;
}

export interface PromptAuditMetadata {
  userId?: string | null;
  promptVersion?: string | null;
  promptFamily?: string | null;
  promptSource?: string | null;
  route?: string | null;
}

const promptAuditByReservation = new Map<string, PromptAuditMetadata>();

export function registerPromptAudit(
  reservationId: string | null | undefined,
  metadata: PromptAuditMetadata
): void {
  if (!reservationId || reservationId === 'no-reservation') return;
  promptAuditByReservation.set(reservationId, {
    ...(promptAuditByReservation.get(reservationId) ?? {}),
    ...metadata,
  });
}

// ─── ERRORS ──────────────────────────────────────────────────────────────────

export class AIBudgetExceededError extends Error {
  readonly status = 429;
  readonly code = 'AI_DAILY_BUDGET_EXCEEDED';
  constructor(
    readonly limitUsd: number,
    readonly estimatedCost: number,
  ) {
    super('Daily AI budget exceeded');
  }
}

export class BudgetSystemUnavailableError extends Error {
  readonly status = 503;
  readonly code = 'BUDGET_SYSTEM_UNAVAILABLE';
  constructor(cause?: unknown) {
    super('AI usage limit system is temporarily unavailable. Please try again shortly.');
    if (cause) this.cause = cause;
  }
}

// ─── COST ESTIMATION ─────────────────────────────────────────────────────────

// Cost per 1k tokens per feature. These are conservative upper-bound
// estimates — actual spend is committed from real token counts.
const COST_PER_1K_TOKENS: Record<BudgetFeature, number> = {
  chat:                    0.0001,
  chat_vision:             0.0003,
  chat_document_vision:    0.0003,
  autopsy:                 0.0005, // multimodal PDF is expensive
  image:                   0.0003,
  planner:                 0.00015,
  'session-card':          0.00005,
  tutor:                   0.0001,
  embedding:               0.000005,
  'memory-scoring':        0.00003,
  'intent-classification': 0.00002,
  'emotional-state':       0.00001,
  'session-analysis':      0.00005,
  welcome:                 0.00003,
  'revision-coach':        0.00005,
  negotiate:               0.0001,
  'knowledge-guide':       0.0002,
  'knowledge-audio':       0.00015,
  analyze:                 0.00005,
  atlas:                   0.00005,
  onboarding:              0.00005,
  'chat-mentor':           0.0001,
  rag_flashcard:           0.00005,
};

const DAILY_BUDGET_USD = () => {
  const v = Number(process.env.AI_PER_USER_DAILY_BUDGET_USD ?? process.env.AI_DAILY_USER_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : 0.25;
};

// Reflection token allowance for models that emit <reflection> blocks
const REFLECTION_ALLOWANCE = 1500;
const TEST_RESERVATION_PREFIX = 'test-reservation:';

function shouldBypassNetworkBudgetForTests(): boolean {
  return (
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') &&
    process.env.ENABLE_NETWORK_BUDGET_TESTS !== 'true'
  );
}

function isTestReservation(reservationId: string): boolean {
  return reservationId.startsWith(TEST_RESERVATION_PREFIX);
}

export function estimateCallCost(
  feature: BudgetFeature,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): { estimatedCost: number; estimatedTokens: number } {
  const outputWithReflection = estimatedOutputTokens + REFLECTION_ALLOWANCE;
  const totalTokens = Math.max(0, estimatedInputTokens + outputWithReflection);
  const estimatedCost = (totalTokens / 1000) * (COST_PER_1K_TOKENS[feature] ?? 0.0001);
  return { estimatedCost, estimatedTokens: totalTokens };
}

// ─── CORE BUDGET OPERATIONS ──────────────────────────────────────────────────

/**
 * Atomically reserve budget before making a paid LLM call.
 *
 * Uses DB-level row locking (SELECT ... FOR UPDATE inside reserve_ai_budget)
 * so concurrent requests cannot both read "within budget" and both proceed.
 *
 * Throws AIBudgetExceededError if the daily limit would be breached.
 * Throws BudgetSystemUnavailableError if the DB RPC is unreachable.
 */
export async function reserveBudgetForModelCall(
  userId: string,
  feature: BudgetFeature,
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number,
): Promise<BudgetReservation> {
  const { estimatedCost, estimatedTokens } = estimateCallCost(
    feature,
    estimatedInputTokens,
    estimatedOutputTokens,
  );

  if (shouldBypassNetworkBudgetForTests()) {
    return {
      reservationId: `${TEST_RESERVATION_PREFIX}${crypto.randomUUID()}`,
      estimatedCost,
      estimatedTokens,
    };
  }

  const expensiveCallGate = await consumeUsageLimit(userId, 'ai_calls_daily');
  if (!expensiveCallGate.allowed) {
    if (expensiveCallGate.code === 'limit_reached') {
      throw new AIBudgetExceededError(0, estimatedCost);
    }
    throw new BudgetSystemUnavailableError(expensiveCallGate.reason);
  }

  if (feature === 'tutor') {
    const tutorGate = await consumeUsageLimit(userId, 'tutor_messages_daily');
    if (!tutorGate.allowed) {
      if (tutorGate.code === 'limit_reached') {
        throw new AIBudgetExceededError(0, estimatedCost);
      }
      throw new BudgetSystemUnavailableError(tutorGate.reason);
    }
  }

  let data: string | null = null;
  let error: any = null;

  try {
    const supabase = createAdminClient();
    const result = await supabase.rpc('reserve_ai_budget', {
      p_user_id: userId,
      p_feature: feature,
      p_model: model || 'unknown',
      p_estimated_cost: estimatedCost,
      p_estimated_tokens: estimatedTokens,
      p_daily_limit_usd: DAILY_BUDGET_USD(),
    });
    data = result.data;
    error = result.error;
  } catch (rpcError: any) {
    logger.error('[BudgetGuard] RPC call threw — failing closed', {
      userId,
      feature,
      error: rpcError?.message,
    });
    throw new BudgetSystemUnavailableError(rpcError);
  }

  if (error) {
    const msg: string = error.message || '';
    if (msg.includes('AI_DAILY_BUDGET_EXCEEDED')) {
      throw new AIBudgetExceededError(DAILY_BUDGET_USD(), estimatedCost);
    }
    if (
      msg.includes('function reserve_ai_budget') ||
      msg.includes('PGRST202') ||
      error.code === 'PGRST202'
    ) {
      logger.error('[BudgetGuard] reserve_ai_budget RPC not found — failing closed', {
        userId,
        feature,
        error: msg,
      });
      throw new BudgetSystemUnavailableError(error);
    }
    // Any other DB error → fail closed
    logger.error('[BudgetGuard] Unexpected DB error — failing closed', {
      userId,
      feature,
      error: msg,
    });
    throw new BudgetSystemUnavailableError(error);
  }

  if (!data) {
    throw new BudgetSystemUnavailableError('reserve_ai_budget returned null');
  }

  logger.info('[BudgetGuard] Reserved', {
    userId,
    feature,
    model,
    estimatedCost,
    estimatedTokens,
    reservationId: data,
  });

  return {
    reservationId: data as string,
    estimatedCost,
    estimatedTokens,
  };
}

/**
 * Commit actual usage after a successful LLM call.
 * Best-effort — logs errors but never throws (we already have the response).
 */
export async function commitBudgetUsage(
  reservationId: string,
  usage: ActualUsage,
): Promise<void> {
  if (shouldBypassNetworkBudgetForTests() && isTestReservation(reservationId)) {
    return;
  }

  const promptTokens = Math.max(0, Math.round(usage.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(usage.completionTokens ?? 0));
  const totalTokens = promptTokens + completionTokens;
  const actualCost = usage.actualCost ?? (totalTokens / 1000) * 0.0001;

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc('commit_ai_usage', {
      p_reservation_id: reservationId,
      p_actual_cost: actualCost,
      p_prompt_tokens: promptTokens,
      p_completion_tokens: completionTokens,
      p_route: usage.route || 'unknown',
    });
    if (error) {
      logger.error('[BudgetGuard] commit_ai_usage failed', {
        reservationId,
        error: error.message,
      });
    } else {
      await applyPromptAuditMetadata(supabase, reservationId, usage);
      logger.info('[BudgetGuard] Committed', {
        reservationId,
        promptTokens,
        completionTokens,
        actualCost,
      });
    }
  } catch (err: any) {
    logger.error('[BudgetGuard] commit_ai_usage threw', {
      reservationId,
      error: err?.message,
    });
  }
}

async function applyPromptAuditMetadata(
  supabase: ReturnType<typeof createAdminClient>,
  reservationId: string,
  usage: ActualUsage
) {
  const registered = promptAuditByReservation.get(reservationId) ?? {};
  const promptVersion = usage.promptVersion ?? registered.promptVersion ?? null;
  const promptFamily = usage.promptFamily ?? registered.promptFamily ?? null;
  const promptSource = usage.promptSource ?? registered.promptSource ?? usage.route ?? registered.route ?? null;

  if (!promptVersion && !promptFamily && !promptSource) return;

  const { error } = await supabase
    .from('ai_usage_events')
    .update({
      prompt_version: promptVersion,
      prompt_family: promptFamily,
      prompt_source: promptSource,
    })
    .eq('reservation_id', reservationId);

  promptAuditByReservation.delete(reservationId);

  if (error) {
    logger.warn('[BudgetGuard] prompt audit metadata update failed', {
      reservationId,
      error: error.message,
    });
  }
}

/**
 * Release a reservation after a failed LLM call.
 * Best-effort — logs errors but never throws.
 */
export async function releaseBudgetReservation(
  reservationId: string,
  reason = 'call_failed',
): Promise<void> {
  if (shouldBypassNetworkBudgetForTests() && isTestReservation(reservationId)) {
    return;
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.rpc('release_ai_budget', {
      p_reservation_id: reservationId,
    });
    if (error) {
      logger.error('[BudgetGuard] release_ai_budget failed', {
        reservationId,
        reason,
        error: error.message,
      });
    } else {
      logger.info('[BudgetGuard] Released', { reservationId, reason });
    }
  } catch (err: any) {
    logger.error('[BudgetGuard] release_ai_budget threw', {
      reservationId,
      reason,
      error: err?.message,
    });
  }
}

// ─── CONVENIENCE: WRAPPED EXECUTION ──────────────────────────────────────────

/**
 * Execute a model call with full reservation→commit/release lifecycle.
 *
 * Usage:
 *   const result = await withBudgetGuard(
 *     { userId, feature: 'chat', model: 'llama-3.3-70b',
 *       estimatedInputTokens: 800, estimatedOutputTokens: 1200 },
 *     async () => {
 *       const text = await callModel(...);
 *       return { result: text, actualUsage: { promptTokens: 750, completionTokens: 950 } };
 *     }
 *   );
 */
export async function withBudgetGuard<T>(
  params: {
    userId: string;
    feature: BudgetFeature;
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    route?: string;
    // Set false ONLY for explicitly free/local calls with a comment explaining why
    requireBudget?: boolean;
  },
  fn: (reservationId: string) => Promise<{ result: T; actualUsage: ActualUsage }>,
): Promise<T> {
  if (params.requireBudget === false) {
    // Explicitly opted-out: caller asserts this is free/local
    const { result } = await fn('no-reservation');
    return result;
  }

  const reservation = await reserveBudgetForModelCall(
    params.userId,
    params.feature,
    params.model,
    params.estimatedInputTokens,
    params.estimatedOutputTokens,
  );

  try {
    const { result, actualUsage } = await fn(reservation.reservationId);
    await commitBudgetUsage(reservation.reservationId, {
      ...actualUsage,
      route: params.route,
    });
    return result;
  } catch (err) {
    await releaseBudgetReservation(
      reservation.reservationId,
      err instanceof Error ? err.message : 'unknown_error',
    );
    throw err;
  }
}

// ─── STREAMING VARIANT ───────────────────────────────────────────────────────

/**
 * Execute a streaming model call with full reservation→commit/release.
 *
 * The caller's generator must yield string chunks. After the generator
 * is exhausted (or throws), actual usage is committed/released.
 *
 * Usage:
 *   for await (const chunk of withBudgetGuardStream(
 *     { userId, feature: 'chat', model: '...', ... },
 *     (reservationId) => routeStreamGeneration(systemPrompt, messages)
 *   )) { ... }
 */
export async function* withBudgetGuardStream(
  params: {
    userId: string;
    feature: BudgetFeature;
    model: string;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    route?: string;
    requireBudget?: boolean;
  },
  makeGenerator: (reservationId: string) => AsyncGenerator<string>,
): AsyncGenerator<string> {
  if (params.requireBudget === false) {
    yield* makeGenerator('no-reservation');
    return;
  }

  const reservation = await reserveBudgetForModelCall(
    params.userId,
    params.feature,
    params.model,
    params.estimatedInputTokens,
    params.estimatedOutputTokens,
  );

  let totalChars = 0;
  let succeeded = false;

  try {
    for await (const chunk of makeGenerator(reservation.reservationId)) {
      totalChars += chunk.length;
      yield chunk;
    }
    succeeded = true;
  } catch (err) {
    await releaseBudgetReservation(
      reservation.reservationId,
      err instanceof Error ? err.message : 'stream_error',
    );
    throw err;
  }

  if (succeeded) {
    // Estimate tokens from character count (~4 chars/token)
    const estimatedOutputTokens = Math.ceil(totalChars / 4);
    await commitBudgetUsage(reservation.reservationId, {
      promptTokens: params.estimatedInputTokens,
      completionTokens: estimatedOutputTokens,
      route: params.route,
    });
  }
}

// ─── BUDGET ERROR RESPONSE HELPERS ───────────────────────────────────────────

export function isBudgetExceeded(err: unknown): err is AIBudgetExceededError {
  return err instanceof AIBudgetExceededError;
}

export function isBudgetUnavailable(err: unknown): err is BudgetSystemUnavailableError {
  return err instanceof BudgetSystemUnavailableError;
}

export function budgetExceededResponse() {
  return NextResponse.json(
    {
      error: 'Daily AI budget exceeded',
      message:
        'Your daily AI budget is used up. Existing plans, cards, and dashboards remain available.',
      code: 'AI_DAILY_BUDGET_EXCEEDED',
    },
    { status: 429 },
  );
}

export function budgetUnavailableResponse() {
  return NextResponse.json(
    {
      error: 'AI usage limit system is temporarily unavailable. Please try again shortly.',
      code: 'BUDGET_SYSTEM_UNAVAILABLE',
    },
    { status: 503 },
  );
}
