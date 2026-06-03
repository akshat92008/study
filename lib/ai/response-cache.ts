// lib/ai/response-cache.ts
// Semantic caching for AI responses, backed by Postgres.
//
// Extremely effective for classification, formula retrieval,
// and deterministic MCQ generation. TTLs are managed by task type.

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAiCostMode, isAiResponseCacheEnabled } from './cost-mode';
import { logger } from '@/lib/utils/logger';
import crypto from 'crypto';

export interface AiCachedResponse {
  responseText?: string;
  responseJson?: any;
  tokenEstimate: number;
  cacheHit: true;
}

export interface SetCacheParams {
  cacheKey: string;
  task: string;
  normalizedPrompt: string; // The input_hash source
  model: string;
  provider: string;
  responseText?: string;
  responseJson?: any;
  tokenEstimate: number;
  userId: string;
}

// ─── TTL CONFIGURATION ─────────────────────────────────────────────────────────

// TTLs in days
const CACHE_TTL_DAYS: Record<string, number> = {
  classification: 7,
  formula_sheet: 30,
  flashcards: 14,
  mcq_generation: 1,
  document_generation: 1,
  explanation: 7,
  autopsy: 7,
};

function getTtlDays(task: string): number {
  return CACHE_TTL_DAYS[task] ?? 1; // Default to 1 day
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

/**
 * Normalizes a prompt to maximize cache hits.
 * Lowercases, trims, and strips volatile IDs (timestamps, UUIDs, session IDs).
 */
export function normalizePromptForCache(prompt: string): string {
  if (!prompt) return '';

  let norm = prompt.toLowerCase().trim();

  // Strip timestamps (13 digit ms, or ISO strings)
  norm = norm.replace(/\b\d{13}\b/g, '[ts]');
  norm = norm.replace(/\b\d{4}-\d{2}-\d{2}t\d{2}:\d{2}:\d{2}\.\d+z\b/gi, '[date]');

  // Strip UUIDs
  norm = norm.replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[uuid]');

  return norm;
}

/**
 * Builds a unique cache key for a given task and prompt.
 * Always factors in the cost mode (so cheap responses don't pollute quality, and vice versa).
 */
export function buildAiCacheKey(task: string, normalizedPrompt: string, costMode?: string): string {
  const mode = costMode ?? getAiCostMode();
  const hash = crypto.createHash('sha256').update(normalizedPrompt).digest('hex');
  return `ai_cache:${mode}:${task}:${hash}`;
}

export function generateInputHash(normalizedPrompt: string): string {
  return crypto.createHash('sha256').update(normalizedPrompt).digest('hex');
}

// ─── API ──────────────────────────────────────────────────────────────────────

/**
 * Attempt to retrieve a cached AI response.
 * Returns null if not found, expired, or caching is disabled.
 */
export async function getCachedAiResponse(
  cacheKey: string,
  userId?: string,
  task?: string
): Promise<AiCachedResponse | null> {
  if (!isAiResponseCacheEnabled()) return null;

  try {
    const supabase = await createClient(); // Use RLS to enforce user isolation if needed

    let query = supabase
      .from('ai_response_cache')
      .select('response_text, response_json, token_estimate')
      .eq('cache_key', cacheKey)
      .gt('expires_at', new Date().toISOString())
      .limit(1);

    // In a real strict environment, RLS policy would enforce user_id matching automatically.
    // However, some caches (like classification) are intentionally cross-user.
    // We enforce user matching explicitly for autopsy.
    if (task === 'autopsy' && userId) {
      query = query.eq('user_id', userId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) {
      logger.warn('[AiResponseCache] Read error', { error: error.message, cacheKey });
      return null;
    }

    if (!data) return null;

    logger.info('[AiResponseCache] HIT', { cacheKey, task });

    return {
      responseText: data.response_text,
      responseJson: data.response_json,
      tokenEstimate: data.token_estimate ?? 0,
      cacheHit: true,
    };
  } catch (err) {
    logger.warn('[AiResponseCache] Read exception', { error: String(err), cacheKey });
    return null;
  }
}

/**
 * Store an AI response in the DB cache.
 * Failures here are silent (logged only) so they don't break the main flow.
 */
export async function setCachedAiResponse(params: SetCacheParams): Promise<void> {
  if (!isAiResponseCacheEnabled()) return;

  try {
    // Write using admin client to bypass any RLS write restrictions
    const supabaseAdmin = createAdminClient();

    const ttlDays = getTtlDays(params.task);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + ttlDays);

    const inputHash = generateInputHash(params.normalizedPrompt);

    const { error } = await supabaseAdmin.from('ai_response_cache').upsert(
      {
        user_id: params.userId, // owner, though some hits may be cross-user (RLS permitting)
        cache_key: params.cacheKey,
        task: params.task,
        model: params.model,
        provider: params.provider,
        input_hash: inputHash,
        response_text: params.responseText ?? null,
        response_json: params.responseJson ?? null,
        token_estimate: params.tokenEstimate,
        expires_at: expiresAt.toISOString(),
      },
      { onConflict: 'cache_key' }
    );

    if (error) {
      logger.warn('[AiResponseCache] Write error', { error: error.message, cacheKey: params.cacheKey });
    }
  } catch (err) {
    logger.warn('[AiResponseCache] Write exception', { error: String(err), cacheKey: params.cacheKey });
  }
}
