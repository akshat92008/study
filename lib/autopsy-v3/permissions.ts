import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/api/errors';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { getAutopsyV3Limits, since24HoursIso } from './limits';
import { betaAccessErrorResponse, requireActiveBetaUser } from '@/lib/access/beta-access';
import { featureDisabledResponse, isBetaFeatureEnabled } from '@/lib/config/beta-flags';

export async function requireAutopsyV3User(requestId: string) {
  const limits = getAutopsyV3Limits();
  if (!limits.enabled) {
    return {
      error: apiErrorResponse('autopsy_v3_disabled', {
        status: 503,
        message: 'Deep Autopsy is temporarily unavailable.',
        requestId,
      }),
    };
  }

  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      error: apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      }),
    };
  }

  let access;
  try {
    access = await requireActiveBetaUser(user.id);
  } catch (accessError) {
    return { error: betaAccessErrorResponse(accessError, requestId) ?? apiErrorResponse('beta_access_required', {
      status: 403,
      message: 'Cognition OS is currently in a limited beta. Ask the admin to activate your beta access.',
      requestId,
    }) };
  }

  if (!isBetaFeatureEnabled('autopsy_upload') && !isBetaFeatureEnabled('autopsy_report')) {
    return { error: featureDisabledResponse(requestId) };
  }

  const rate = await checkRateLimit({
    identifier: user.id,
    bucket: 'autopsy-v3',
    maxTokens: 60,
    windowSeconds: 60,
    failClosed: true,
  });
  if (!rate.allowed) {
    return { error: rateLimitResponse(rate.remaining, rate.resetAt) };
  }

  return { supabase, user, limits, access };
}

export async function enforceDailyTableCap(input: {
  supabase: any;
  userId: string;
  table: string;
  limit: number;
  requestId: string;
  message: string;
  extra?: (query: any) => any;
}) {
  if (input.limit <= 0) {
    return apiErrorResponse('daily_limit_reached', {
      status: 429,
      message: input.message,
      requestId: input.requestId,
    });
  }

  let query = input.supabase
    .from(input.table)
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .gte('created_at', since24HoursIso());
  if (input.extra) query = input.extra(query);

  const { count, error } = await query;
  if (error) throw error;
  if ((count ?? 0) >= input.limit) {
    return apiErrorResponse('daily_limit_reached', {
      status: 429,
      message: input.message,
      requestId: input.requestId,
    });
  }
  return null;
}

export function jsonWithRequestId(body: unknown, requestId: string, status = 200) {
  return NextResponse.json(body, { status, headers: { 'x-request-id': requestId } });
}
