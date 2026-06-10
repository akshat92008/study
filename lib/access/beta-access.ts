import 'server-only';

import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { isFeatureEnabled, type AppFeature } from '@/lib/feature-registry';
import type { SubscriptionTier } from '@/lib/billing/tiers';
import { normalizeSubscriptionTier } from '@/lib/billing/tiers';
import type { FeatureName } from '@/lib/usage/enforce-feature-limit';
import { getAppLaunchMode } from '@/lib/feature-registry';

export type AccessState = {
  userId: string;
  isAdmin: boolean;
  hasBetaAccess: boolean;
  plan: SubscriptionTier;
  accessSource: 'admin' | 'manual_beta' | 'manual_plan' | 'free';
  betaAccessUntil: string | null;
  blockedReason?: string;
};

export class BetaAccessError extends Error {
  constructor(
    readonly code: 'unauthorized' | 'beta_access_required' | 'account_suspended' | 'feature_temporarily_disabled' | 'payment_required',
    message: string,
    readonly status = code === 'unauthorized' ? 401 : code === 'feature_temporarily_disabled' ? 503 : code === 'payment_required' ? 402 : 403,
    readonly accessState?: AccessState,
  ) {
    super(message);
  }
}

function listFromEnv(key: string): string[] {
  return (process.env[key] || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function isConfiguredAdmin(userId: string, email?: string | null): boolean {
  const adminIds = new Set(listFromEnv('ADMIN_USER_IDS'));
  const adminEmails = new Set(listFromEnv('ADMIN_EMAILS').map((value) => value.toLowerCase()));
  return adminIds.has(userId) || (!!email && adminEmails.has(email.toLowerCase()));
}

function betaUntilIsActive(value: string | null | undefined): boolean {
  if (!value) return true;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) && timestamp > Date.now();
}

function featureToFlag(feature: FeatureName): AppFeature | null {
  switch (feature) {
    case 'ai_call':
      return 'ai_global';
    case 'worker_ai_call':
      return 'worker_ai';
    case 'autopsy_report':
      return 'autopsy_report';
    case 'rag_upload':
    case 'material_upload':
      return 'rag_upload';
    case 'material_query':
      return 'rag_query';
    case 'hermes_write':
      return 'hermes_write';
    case 'revision_generation':
      return 'revision';
    default:
      return null;
  }
}

export async function getUserAccessState(userId: string | null | undefined): Promise<AccessState> {
  if (!userId) {
    return {
      userId: '',
      isAdmin: false,
      hasBetaAccess: false,
      plan: 'free',
      accessSource: 'free',
      betaAccessUntil: null,
      blockedReason: 'unauthenticated',
    };
  }

  if (process.env.NODE_ENV === 'test' && process.env.PAID_BETA_GATE_ENABLED == null) {
    return {
      userId,
      isAdmin: false,
      hasBetaAccess: true,
      plan: 'free',
      accessSource: 'manual_beta',
      betaAccessUntil: null,
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('id,email,beta_access,beta_access_until,manual_plan,suspended,suspended_reason,subscription_status')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    return {
      userId,
      isAdmin: isConfiguredAdmin(userId),
      hasBetaAccess: false,
      plan: 'free',
      accessSource: 'free',
      betaAccessUntil: null,
      blockedReason: 'profile_unavailable',
    };
  }

  const profile = (data ?? {}) as Record<string, any>;
  const manualPlan = normalizeSubscriptionTier(profile.manual_plan ?? profile.subscription_status);
  const isAdmin = isConfiguredAdmin(userId, profile.email) || manualPlan === 'admin';
  const betaAccessUntil = profile.beta_access_until ?? null;
  const hasManualPlan = manualPlan === 'founding' || manualPlan === 'pro' || manualPlan === 'admin';
  const betaAccessActive = profile.beta_access === true && betaUntilIsActive(betaAccessUntil);

  if (profile.suspended === true && !isAdmin) {
    return {
      userId,
      isAdmin,
      hasBetaAccess: false,
      plan: manualPlan,
      accessSource: hasManualPlan ? 'manual_plan' : 'free',
      betaAccessUntil,
      blockedReason: 'account_suspended',
    };
  }

  if (isAdmin) {
    return {
      userId,
      isAdmin,
      hasBetaAccess: true,
      plan: 'admin',
      accessSource: 'admin',
      betaAccessUntil,
    };
  }

  if (hasManualPlan) {
    return {
      userId,
      isAdmin,
      hasBetaAccess: true,
      plan: manualPlan,
      accessSource: 'manual_plan',
      betaAccessUntil,
    };
  }

  if (betaAccessActive) {
    return {
      userId,
      isAdmin,
      hasBetaAccess: true,
      plan: 'free',
      accessSource: 'manual_beta',
      betaAccessUntil,
    };
  }

  return {
    userId,
    isAdmin,
    hasBetaAccess: !isFeatureEnabled('paid_gate'),
    plan: manualPlan,
    accessSource: 'free',
    betaAccessUntil,
    blockedReason:
      profile.beta_access === true && !betaUntilIsActive(betaAccessUntil)
        ? 'beta_access_expired'
        : getAppLaunchMode() === 'public_paid'
          ? 'payment_required'
          : isFeatureEnabled('paid_gate')
            ? 'beta_access_required'
            : undefined,
  };
}

export async function requireBetaAccess(userId: string | null | undefined): Promise<AccessState> {
  const access = await getUserAccessState(userId);
  if (access.blockedReason === 'unauthenticated') {
    throw new BetaAccessError('unauthorized', 'Authentication is required.', 401, access);
  }
  if (access.blockedReason === 'account_suspended') {
    throw new BetaAccessError(
      'account_suspended',
      'Your account is currently paused. Contact support.',
      403,
      access,
    );
  }
  if (!access.hasBetaAccess) {
    if (access.blockedReason === 'payment_required' || getAppLaunchMode() === 'public_paid') {
      throw new BetaAccessError(
        'payment_required',
        'An active subscription is required to access this feature.',
        402,
        access,
      );
    }
    throw new BetaAccessError(
      'beta_access_required',
      'An active subscription is required to access this feature.',
      403,
      access,
    );
  }
  return access;
}

export async function requireActiveBetaUser(userId: string | null | undefined): Promise<AccessState> {
  return requireBetaAccess(userId);
}

export async function canUseFeature(userId: string | null | undefined, feature: FeatureName): Promise<boolean> {
  try {
    await assertFeatureAccess(userId, feature);
    return true;
  } catch {
    return false;
  }
}

export async function assertFeatureAccess(
  userId: string | null | undefined,
  feature: FeatureName,
): Promise<AccessState> {
  const access = await requireBetaAccess(userId);
  const flag = featureToFlag(feature);
  if (flag && !isFeatureEnabled(flag)) {
    throw new BetaAccessError(
      'feature_temporarily_disabled',
      'This feature is temporarily paused during beta maintenance.',
      503,
      access,
    );
  }
  return access;
}

export function betaAccessErrorResponse(error: unknown, requestId?: string): NextResponse | null {
  if (!(error instanceof BetaAccessError)) return null;
  return NextResponse.json(
    {
      error: error.code,
      message: error.message,
      ...(requestId ? { requestId } : {}),
    },
    {
      status: error.status,
      headers: requestId ? { 'x-request-id': requestId } : undefined,
    }
  );
}
