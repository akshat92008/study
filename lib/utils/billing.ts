import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { getMaxPromptChars, isPromptTooLarge } from '@/lib/ai/token-budget';

export type FeatureLimit =
  | 'chat_messages_daily'
  | 'chat_messages_hourly'
  | 'tutor_messages_daily'
  | 'autopsy_uploads_daily'
  | 'ai_calls_daily'
  | 'document_uploads'
  | 'tutor_queries_daily'
  | 'autopsies_monthly'
  | 'expensive_operations_daily';

export type UsageGateCode =
  | 'limit_reached'
  | 'auth_required'
  | 'file_too_large'
  | 'prompt_too_large'
  | 'usage_check_failed';

export type UsageGateResult = {
  allowed: boolean;
  code?: UsageGateCode;
  reason?: string;
  limit?: number;
  used?: number;
  remaining?: number;
};

const DEFAULT_LIMITS: Record<FeatureLimit, number> = {
  chat_messages_daily: 40,
  chat_messages_hourly: 10,
  tutor_messages_daily: 60,
  autopsy_uploads_daily: 5,
  ai_calls_daily: 120,
  document_uploads: 20,
  tutor_queries_daily: 60,
  autopsies_monthly: 20,
  expensive_operations_daily: 10,
};

const LIMIT_ENV: Partial<Record<FeatureLimit, string>> = {
  chat_messages_daily: 'FREE_DAILY_CHAT_LIMIT',
  chat_messages_hourly: 'FREE_HOURLY_CHAT_LIMIT',
  tutor_messages_daily: 'FREE_DAILY_TUTOR_LIMIT',
  autopsy_uploads_daily: 'FREE_DAILY_AUTOPSY_LIMIT',
  ai_calls_daily: 'DAILY_USER_AI_REQUEST_LIMIT',
  document_uploads: 'FREE_DAILY_AUTOPSY_LIMIT',
  tutor_queries_daily: 'FREE_DAILY_TUTOR_LIMIT',
  autopsies_monthly: 'FREE_DAILY_AUTOPSY_LIMIT',
  expensive_operations_daily: 'FREE_DAILY_EXPENSIVE_LIMIT',
};

const LIMIT_ENV_FALLBACKS: Partial<Record<FeatureLimit, string[]>> = {
  ai_calls_daily: ['FREE_DAILY_AI_CALL_LIMIT'],
};

const RPC_GATE_MAP: Record<FeatureLimit, string> = {
  chat_messages_daily: 'chat_messages',
  chat_messages_hourly: 'chat_messages_hourly',
  tutor_messages_daily: 'tutor_messages',
  autopsy_uploads_daily: 'autopsy_uploads',
  ai_calls_daily: 'ai_calls',
  document_uploads: 'autopsy_uploads',
  tutor_queries_daily: 'tutor_messages',
  autopsies_monthly: 'autopsy_uploads',
  expensive_operations_daily: 'expensive_operations',
};

export function getLimit(feature: FeatureLimit): number {
  const envName = LIMIT_ENV[feature];
  const primary = envName ? Number(process.env[envName]) : NaN;
  const fallback = (LIMIT_ENV_FALLBACKS[feature] ?? [])
    .map((key) => Number(process.env[key]))
    .find((value) => Number.isFinite(value));
  const configured = Number.isFinite(primary) ? primary : (fallback ?? NaN);
  return Number.isFinite(configured) && configured >= 0
    ? Math.floor(configured)
    : DEFAULT_LIMITS[feature];
}

export function getMaxUploadBytes(): number {
  const configured = Number(process.env.MAX_UPLOAD_BYTES);
  return Number.isFinite(configured) && configured > 0
    ? Math.floor(configured)
    : 20 * 1024 * 1024;
}

function developmentMayFailOpen(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.ALLOW_USAGE_GATE_FAIL_OPEN === 'true';
}

export function usageGateResponse(result: UsageGateResult): NextResponse {
  const status =
    result.code === 'auth_required' ? 401 :
    result.code === 'file_too_large' || result.code === 'prompt_too_large' ? 413 :
    result.code === 'limit_reached' ? 429 :
    503;

  return NextResponse.json(
    {
      error: result.code ?? 'usage_check_failed',
      message: result.reason ?? 'Usage could not be verified. Please try again shortly.',
      limit: result.limit,
      used: result.used,
      remaining: result.remaining,
      upgradeUrl: result.code === 'limit_reached' ? '/api/billing/checkout' : undefined,
    },
    { status }
  );
}

export function enforceAuthenticatedUsage(userId?: string | null): UsageGateResult {
  if (!userId) {
    return {
      allowed: false,
      code: 'auth_required',
      reason: 'Authentication is required for AI features.',
    };
  }
  return { allowed: true };
}

export function validatePromptLength(input: string): UsageGateResult {
  const limit = getMaxPromptChars();
  if (isPromptTooLarge(input, limit)) {
    return {
      allowed: false,
      code: 'prompt_too_large',
      reason: `Input is too long. Maximum is ${limit} characters.`,
      limit,
      used: input.length,
      remaining: 0,
    };
  }
  return { allowed: true, limit, used: input.length, remaining: Math.max(0, limit - input.length) };
}

export function validateUploadBytes(sizeBytes: number): UsageGateResult {
  const limit = getMaxUploadBytes();
  if (sizeBytes > limit) {
    return {
      allowed: false,
      code: 'file_too_large',
      reason: `File too large. Maximum size is ${Math.round(limit / 1024 / 1024)}MB.`,
      limit,
      used: sizeBytes,
      remaining: 0,
    };
  }
  return { allowed: true, limit, used: sizeBytes, remaining: Math.max(0, limit - sizeBytes) };
}

export async function consumeUsageLimit(
  userId: string | null | undefined,
  feature: FeatureLimit,
  amount = 1
): Promise<UsageGateResult> {
  const auth = enforceAuthenticatedUsage(userId);
  if (!auth.allowed) return auth;

  const limit = getLimit(feature);
  const subscriptionStatus = await getUserSubscriptionStatus(userId as string);
  if (subscriptionStatus !== 'free') {
    return {
      allowed: true,
      limit: Number.MAX_SAFE_INTEGER,
      used: 0,
      remaining: Number.MAX_SAFE_INTEGER,
    };
  }

  if (limit === 0) {
    const isHourly = feature === 'chat_messages_hourly';
    return {
      allowed: false,
      code: 'limit_reached',
      reason: isHourly ? 'Hourly usage limit reached. Please wait a bit.' : 'Daily usage limit reached. Try again tomorrow.',
      limit,
      used: 0,
      remaining: 0,
    };
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('check_and_increment_usage_gate', {
      p_user_id: userId,
      p_gate: RPC_GATE_MAP[feature],
      p_limit: limit,
      p_amount: Math.max(1, Math.floor(amount)),
    });

    if (error) {
      throw error;
    }

    const result = (data ?? {}) as { allowed?: boolean; used?: number; remaining?: number; limit?: number };
    if (result.allowed === false) {
      const isHourly = feature === 'chat_messages_hourly';
      return {
        allowed: false,
        code: 'limit_reached',
        reason: isHourly ? 'Hourly usage limit reached. Please wait a bit.' : 'Daily usage limit reached. Try again tomorrow.',
        limit: result.limit ?? limit,
        used: result.used,
        remaining: result.remaining ?? 0,
      };
    }

    return {
      allowed: true,
      limit: result.limit ?? limit,
      used: result.used,
      remaining: result.remaining,
    };
  } catch (error: any) {
    logger.error('[UsageGate] usage check failed', {
      userId,
      feature,
      error: error?.message ?? String(error),
    });

    if (developmentMayFailOpen()) {
      logger.warn('[UsageGate] allowing request because development fail-open is explicitly enabled', {
        userId,
        feature,
      });
      return { allowed: true, limit, remaining: limit };
    }

    return {
      allowed: false,
      code: 'usage_check_failed',
      reason: 'Usage limits could not be verified. Please try again shortly.',
      limit,
      remaining: 0,
    };
  }
}

export async function checkUsageLimit(
  userId: string,
  feature: FeatureLimit
): Promise<{ allowed: boolean; reason?: string }> {
  const auth = enforceAuthenticatedUsage(userId);
  if (!auth.allowed) return { allowed: false, reason: auth.code };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('ai_usage_daily')
      .select('chat_messages, chat_messages_hourly, tutor_messages, autopsy_uploads, ai_calls, expensive_operations')
      .eq('user_id', userId)
      .eq('usage_date', new Date().toISOString().split('T')[0])
      .maybeSingle();
    if (error) throw error;

    const gate = RPC_GATE_MAP[feature];
    const row = data as Record<string, any> | null;
    const used = Number(row?.[gate] ?? 0);
    return {
      allowed: used < getLimit(feature),
      reason: used < getLimit(feature) ? undefined : 'limit_reached',
    };
  } catch (error: any) {
    logger.error('[UsageGate] read-only usage check failed', { userId, feature, error: error?.message });
    if (developmentMayFailOpen()) return { allowed: true };
    return { allowed: false, reason: 'usage_check_failed' };
  }
}

export async function getUserSubscriptionStatus(
  userId: string
): Promise<'free' | 'pro' | 'teams'> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('profiles')
      .select('subscription_status')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;

    const status = String(data?.subscription_status || 'free').toLowerCase();
    if (status === 'teams') return 'teams';
    if (status === 'pro' || status === 'active' || status === 'trialing') return 'pro';
    return 'free';
  } catch (error: any) {
    logger.warn('[Billing] subscription status unavailable; defaulting to free', {
      userId,
      error: error?.message,
    });
    return 'free';
  }
}

export async function incrementUsage(
  userId: string,
  feature: FeatureLimit
): Promise<void> {
  const result = await consumeUsageLimit(userId, feature);
  if (!result.allowed) {
    throw new Error(result.code ?? 'usage_check_failed');
  }
}
