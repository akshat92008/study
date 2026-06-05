import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { betaAccessErrorResponse, requireActiveBetaUser } from '@/lib/access/beta-access';

type RateLimitConfig = {
  bucket: string;
  maxTokens: number;
  windowSeconds: number;
};

const ROUTE_LIMITS: Record<string, RateLimitConfig & { failClosed?: boolean }> = {
  autopsy:   { bucket: 'autopsy',   maxTokens: 10, windowSeconds: 300, failClosed: true },  // 10/5min
  ingest:    { bucket: 'ingest',    maxTokens: 10, windowSeconds: 300 },  // 10/5min
  revision:  { bucket: 'revision',  maxTokens: 60, windowSeconds: 60  },  // 60/min
  planner:   { bucket: 'planner',   maxTokens: 10, windowSeconds: 60, failClosed: true },  // 10/min
  atlas:     { bucket: 'atlas',     maxTokens: 30, windowSeconds: 60  },  // 30/min
  knowledge: { bucket: 'knowledge', maxTokens: 30, windowSeconds: 60  },  // 30/min
};

export function withRateLimit(
  routeName: keyof typeof ROUTE_LIMITS,
  handler: (req: NextRequest, userId: string, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    const requestId = getRequestId(req);
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return apiErrorResponse('unauthorized', {
          status: 401,
          message: 'Authentication is required.',
          requestId,
        });
      }

      try {
        await requireActiveBetaUser(user.id);
      } catch (accessError) {
        return betaAccessErrorResponse(accessError, requestId) ?? apiErrorResponse('beta_access_required', {
          status: 403,
          message: 'Cognition OS is currently in a limited beta. Ask the admin to activate your beta access.',
          requestId,
        });
      }

      const config = ROUTE_LIMITS[routeName];
      const { allowed, remaining, resetAt } = await checkRateLimit({
        identifier: user.id,
        ...config,
      });

      if (!allowed) return rateLimitResponse(remaining, resetAt);
      return await handler(req, user.id, ...args);
    } catch (error) {
      return unexpectedApiErrorResponse(req, error, routeName, 'Request failed.');
    }
  };
}
