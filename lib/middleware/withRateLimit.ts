import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

type RateLimitConfig = {
  bucket: string;
  maxTokens: number;
  windowSeconds: number;
};

const ROUTE_LIMITS: Record<string, RateLimitConfig & { failClosed?: boolean }> = {
  autopsy:   { bucket: 'autopsy',   maxTokens: 5,  windowSeconds: 300, failClosed: true },  // 5/5min
  ingest:    { bucket: 'ingest',    maxTokens: 10, windowSeconds: 300 },  // 10/5min
  revision:  { bucket: 'revision',  maxTokens: 60, windowSeconds: 60  },  // 60/min
  planner:   { bucket: 'planner',   maxTokens: 10, windowSeconds: 60, failClosed: true },  // 10/min
  atlas:     { bucket: 'atlas',     maxTokens: 30, windowSeconds: 60  },  // 30/min
  knowledge: { bucket: 'knowledge', maxTokens: 30, windowSeconds: 60  },  // 30/min
};

export function withRateLimit(
  routeName: keyof typeof ROUTE_LIMITS,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = getRequestId(req);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const config = ROUTE_LIMITS[routeName];
    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      ...config,
    });

    if (!allowed) return rateLimitResponse(remaining, resetAt);
    try {
      return await handler(req, user.id);
    } catch (error) {
      return unexpectedApiErrorResponse(req, error, routeName, 'Request failed.');
    }
  };
}
