import 'server-only';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { assertFeatureAccess } from '@/lib/access/beta-access';
import { getFeatureLimits, getAppLaunchMode } from '@/lib/feature-registry';
import { getFeatureLimit, getPlanLimits } from '@/lib/billing/plan-limits';
import { type SubscriptionTier } from '@/lib/billing/tiers';
import { logger } from '@/lib/utils/logger';

export type FeatureName =
  | 'chat_message'
  | 'ai_call'
  | 'autopsy_report'
  | 'autopsy_upload'
  | 'rag_upload'
  | 'material_query'
  | 'material_upload'
  | 'hermes_write'
  | 'revision_generation'
  | 'assessment_create'
  | 'worker_ai_call';

export type FeatureLimitCheck = {
  allowed: boolean;
  userId: string;
  feature: FeatureName;
  plan: SubscriptionTier;
  limit: number;
  used: number;
  remaining: number;
  monthlyAiBudgetUsd: number;
  monthlyAiSpendUsd: number;
  code?: 'usage_limit_exceeded' | 'monthly_ai_budget_exceeded' | 'global_limit_exceeded' | 'usage_system_unavailable';
  message?: string;
};

export class FeatureLimitError extends Error {
  readonly status = 429;
  constructor(readonly check: FeatureLimitCheck) {
    super(check.message || 'Usage limit exceeded.');
  }
}

const AI_FEATURES = new Set<FeatureName>(['ai_call', 'worker_ai_call']);

function dayStartIso(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function monthStartIso(): string {
  const date = new Date();
  date.setUTCDate(1);
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

function isReservedOrCommitted(row: any): boolean {
  return row?.status === 'committed' || row?.status === 'reserved' || row?.status == null;
}

function sumAmounts(rows: any[] | null | undefined): number {
  return (rows ?? []).filter(isReservedOrCommitted).reduce((sum, row) => sum + Number(row.amount ?? 1), 0);
}

function sumCost(rows: any[] | null | undefined): number {
  return (rows ?? []).filter(isReservedOrCommitted).reduce((sum, row) => sum + Number(row.estimated_cost_usd ?? 0), 0);
}

async function loadUsageRows(
  userId: string,
  feature: FeatureName,
  sinceIso: string,
): Promise<any[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('feature_usage_events')
    .select('amount,status,estimated_cost_usd')
    .eq('user_id', userId)
    .eq('feature', feature)
    .gte('created_at', sinceIso);
  if (error) throw error;
  return (data ?? []) as any[];
}

async function loadMonthlyAiUsage(userId: string): Promise<any[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('feature_usage_events')
    .select('feature,amount,status,estimated_cost_usd')
    .eq('user_id', userId)
    .in('feature', Array.from(AI_FEATURES))
    .gte('created_at', monthStartIso());
  if (error) throw error;
  return (data ?? []) as any[];
}

async function checkGlobalLimits(feature: FeatureName): Promise<{ allowed: boolean; message?: string }> {
  const flags = getFeatureLimits();
  const supabase = createAdminClient();
  const since = dayStartIso();

  const featureLimit =
    feature === 'chat_message'
      ? flags.globalChatMessagesPerDay
      : feature === 'autopsy_report'
        ? flags.globalAutopsyReportsPerDay
        : feature === 'rag_upload' || feature === 'material_upload'
          ? flags.globalRagUploadsPerDay
          : feature === 'ai_call' || feature === 'worker_ai_call'
            ? flags.globalDailyAiRequestLimit
            : 0;

  if (featureLimit <= 0) return { allowed: true };

  const { count, error } = await supabase
    .from('feature_usage_events')
    .select('id', { count: 'exact', head: true })
    .eq('feature', feature)
    .in('status', ['committed', 'reserved'])
    .gte('created_at', since);
  if (error) throw error;
  if ((count ?? 0) >= featureLimit) {
    return { allowed: false, message: 'This feature has reached today\'s beta safety limit.' };
  }
  return { allowed: true };
}

export async function checkFeatureLimit(
  userId: string,
  feature: FeatureName,
  amount = 1,
): Promise<FeatureLimitCheck> {
  const access = await assertFeatureAccess(userId, feature);
  const limits = getPlanLimits(access.plan);
  const limit = getFeatureLimit(access.plan, feature);

  if (
    feature === 'chat_message' ||
    feature === 'material_upload' ||
    feature === 'ai_call' ||
    (process.env.NODE_ENV === 'test' && process.env.ENABLE_FEATURE_USAGE_TESTS !== 'true') ||
    process.env.BYPASS_ALL_LIMITS === 'true'
  ) {
    return {
      allowed: true,
      userId,
      feature,
      plan: access.plan,
      limit,
      used: 0,
      remaining: Math.max(0, limit - amount),
      monthlyAiBudgetUsd: limits.monthlyAiBudgetUsd,
      monthlyAiSpendUsd: 0,
    };
  }

  try {
    const [dailyRows, monthlyAiRows, globalCheck] = await Promise.all([
      loadUsageRows(userId, feature, dayStartIso()),
      AI_FEATURES.has(feature) ? loadMonthlyAiUsage(userId) : Promise.resolve([]),
      checkGlobalLimits(feature),
    ]);

    const used = sumAmounts(dailyRows);
    const monthlyAiSpendUsd = sumCost(monthlyAiRows);
    const remaining = Math.max(0, limit - used);

    if (!globalCheck.allowed) {
      return {
        allowed: false,
        userId,
        feature,
        plan: access.plan,
        limit,
        used,
        remaining,
        monthlyAiBudgetUsd: limits.monthlyAiBudgetUsd,
        monthlyAiSpendUsd,
        code: 'global_limit_exceeded',
        message: globalCheck.message,
      };
    }

    if (AI_FEATURES.has(feature) && monthlyAiSpendUsd >= limits.monthlyAiBudgetUsd) {
      return {
        allowed: false,
        userId,
        feature,
        plan: access.plan,
        limit,
        used,
        remaining,
        monthlyAiBudgetUsd: limits.monthlyAiBudgetUsd,
        monthlyAiSpendUsd,
        code: 'monthly_ai_budget_exceeded',
        message: 'Your monthly beta AI budget has been reached.',
      };
    }

    if (limit <= 0 || used + amount > limit) {
      return {
        allowed: false,
        userId,
        feature,
        plan: access.plan,
        limit,
        used,
        remaining,
        monthlyAiBudgetUsd: limits.monthlyAiBudgetUsd,
        monthlyAiSpendUsd,
        code: 'usage_limit_exceeded',
        message: 'Your beta usage limit for this feature has been reached.',
      };
    }

    return {
      allowed: true,
      userId,
      feature,
      plan: access.plan,
      limit,
      used,
      remaining: Math.max(0, remaining - amount),
      monthlyAiBudgetUsd: limits.monthlyAiBudgetUsd,
      monthlyAiSpendUsd,
    };
  } catch (error: any) {
    logger.error('[FeatureUsage] usage check failed closed', {
      userId,
      feature,
      error: error?.message ?? String(error),
    });
    return {
      allowed: false,
      userId,
      feature,
      plan: access.plan,
      limit,
      used: 0,
      remaining: 0,
      monthlyAiBudgetUsd: limits.monthlyAiBudgetUsd,
      monthlyAiSpendUsd: 0,
      code: 'usage_system_unavailable',
      message: 'Usage limits could not be verified. Please try again shortly.',
    };
  }
}

export async function consumeFeatureUsage(
  userId: string,
  feature: FeatureName,
  amount = 1,
  metadata: Record<string, unknown> = {},
): Promise<FeatureLimitCheck> {
  const check = await checkFeatureLimit(userId, feature, amount);
  if (!check.allowed) return check;

  if (process.env.NODE_ENV === 'test' && process.env.ENABLE_FEATURE_USAGE_TESTS !== 'true') {
    return check;
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from('feature_usage_events').insert({
    user_id: userId,
    feature,
    amount: Math.max(1, Math.floor(amount)),
    estimated_cost_usd: Number(metadata.estimatedCostUsd ?? 0),
    metadata,
    status: 'committed',
    idempotency_key: metadata.idempotencyKey ?? null,
  });
  if (error) {
    logger.error('[FeatureUsage] failed to record usage', { userId, feature, error: error.message });
    return {
      ...check,
      allowed: false,
      remaining: 0,
      code: 'usage_system_unavailable',
      message: 'Usage could not be recorded. Please try again shortly.',
    };
  }

  return check;
}

export async function enforceFeatureLimit(
  userId: string,
  feature: FeatureName,
  options: { amount?: number } = {},
): Promise<FeatureLimitCheck> {
  const check = await checkFeatureLimit(userId, feature, options.amount ?? 1);
  if (!check.allowed) throw new FeatureLimitError(check);
  return check;
}

export async function reserveUsage(
  userId: string,
  feature: FeatureName,
  amount = 1,
  metadata: Record<string, unknown> = {},
): Promise<string> {
  await enforceFeatureLimit(userId, feature, { amount });
  const idempotencyKey = String(metadata.idempotencyKey ?? `${feature}:${userId}:${crypto.randomUUID()}`);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('feature_usage_events')
    .insert({
      user_id: userId,
      feature,
      amount,
      estimated_cost_usd: Number(metadata.estimatedCostUsd ?? 0),
      metadata,
      status: 'reserved',
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();
  if (error || !data?.id) throw error || new Error('Usage reservation failed');
  return data.id as string;
}

export async function commitUsage(reservationId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('feature_usage_events')
    .update({ status: 'committed', metadata })
    .eq('id', reservationId);
  if (error) throw error;
}

export async function releaseUsage(reservationId: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from('feature_usage_events')
    .update({ status: 'released', metadata })
    .eq('id', reservationId);
  if (error) throw error;
}

export async function getUserUsageSnapshot(userId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('feature_usage_events')
    .select('feature,amount,estimated_cost_usd,status,created_at')
    .eq('user_id', userId)
    .gte('created_at', dayStartIso());
  if (error) throw error;
  return { today: data ?? [] };
}

export async function getAdminUsageSnapshot() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('feature_usage_events')
    .select('user_id,feature,amount,estimated_cost_usd,status,created_at')
    .gte('created_at', dayStartIso())
    .limit(1000);
  if (error) throw error;
  return { today: data ?? [] };
}

export function featureLimitResponse(check: FeatureLimitCheck, requestId?: string): NextResponse {
  const isPublicPaid = getAppLaunchMode() === 'public_paid';
  const shouldRequireUpgrade = isPublicPaid && check.plan === 'free' && check.code !== 'usage_system_unavailable';
  
  return NextResponse.json(
    {
      error: shouldRequireUpgrade ? 'payment_required' : (check.code ?? 'usage_limit_exceeded'),
      message: shouldRequireUpgrade 
        ? 'Upgrade to a paid plan to continue using this feature.' 
        : (check.message ?? 'Your beta usage limit for this feature has been reached.'),
      limit: check.limit,
      used: check.used,
      remaining: check.remaining,
      plan: check.plan,
      ...(requestId ? { requestId } : {}),
    },
    { 
      status: check.code === 'usage_system_unavailable' ? 503 : shouldRequireUpgrade ? 402 : 429, 
      headers: requestId ? { 'x-request-id': requestId } : undefined 
    },
  );
}
