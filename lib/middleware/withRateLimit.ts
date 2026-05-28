import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';

type RateLimitConfig = {
  bucket: string;
  maxTokens: number;
  windowSeconds: number;
};

const ROUTE_LIMITS: Record<string, RateLimitConfig> = {
  autopsy:   { bucket: 'autopsy',   maxTokens: 5,  windowSeconds: 300 },  // 5/5min
  ingest:    { bucket: 'ingest',    maxTokens: 10, windowSeconds: 300 },  // 10/5min
  revision:  { bucket: 'revision',  maxTokens: 60, windowSeconds: 60  },  // 60/min
  planner:   { bucket: 'planner',   maxTokens: 10, windowSeconds: 60  },  // 10/min
  pulse:     { bucket: 'pulse',     maxTokens: 60, windowSeconds: 60  },  // 60/min
  atlas:     { bucket: 'atlas',     maxTokens: 30, windowSeconds: 60  },  // 30/min
  knowledge: { bucket: 'knowledge', maxTokens: 30, windowSeconds: 60  },  // 30/min
};

export function withRateLimit(
  routeName: keyof typeof ROUTE_LIMITS,
  handler: (req: NextRequest, userId: string) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const config = ROUTE_LIMITS[routeName];
    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      ...config,
    });

    if (!allowed) return rateLimitResponse(remaining, resetAt);
    return handler(req, user.id);
  };
}
