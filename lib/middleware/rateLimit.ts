// lib/middleware/rateLimit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { Metrics } from '@/lib/observability/metrics';

type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  degraded?: boolean; // true = Redis down, fail-open
};

let redis: Redis | null = null;
let limiters: Record<string, Ratelimit> = {};

function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      console.warn('[RateLimit] Upstash credentials missing — fail-open mode');
      return null;
    }
    redis = new Redis({ url, token });
    return redis;
  } catch (err) {
    console.error('[RateLimit] Redis init failed:', err);
    return null;
  }
}

function getLimiter(name: string, requests: number, window: string): Ratelimit | null {
  const r = getRedis();
  if (!r) return null;
  const key = `${name}:${requests}:${window}`;
  if (limiters[key]) return limiters[key];
  limiters[key] = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(requests, window as any),
    analytics: true,
    prefix: `rl:${name}`,
  });
  return limiters[key];
}

import { NextResponse } from 'next/server';

export function rateLimitResponse(remaining: number, resetAt: number) {
  return NextResponse.json(
    { error: 'Too many requests, please slow down.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetAt.toString(),
      },
    }
  );
}

/**
 * Check rate limit. FAILS OPEN on Redis errors (logs incident).
 * This prevents Redis outages from taking down the entire product.
 */
export async function checkRateLimit(
  identifierOrOptions: string | { identifier: string; bucket: string; maxTokens: number; windowSeconds: number },
  options?: {
    name: string;
    requests: number;
    window: string;
  }
): Promise<RateLimitResult> {
  let id: string;
  let opt: { name: string; requests: number; window: string };

  if (typeof identifierOrOptions === 'string') {
    id = identifierOrOptions;
    opt = options!;
  } else {
    id = identifierOrOptions.identifier;
    opt = {
      name: identifierOrOptions.bucket,
      requests: identifierOrOptions.maxTokens,
      window: `${identifierOrOptions.windowSeconds} s`,
    };
  }

  const limiter = getLimiter(opt.name, opt.requests, opt.window);
  
  // FAIL OPEN: if Redis is unavailable, allow request but mark as degraded
  if (!limiter) {
    return {
      allowed: true,
      remaining: opt.requests,
      resetAt: Date.now() + 60000,
      limit: opt.requests,
      degraded: true,
    };
  }

  try {
    const { success, remaining, reset, limit } = await limiter.limit(id);
    if (!success) {
      Metrics.rateLimitHit(opt.name, id);
    }
    return {
      allowed: success,
      remaining,
      resetAt: reset,
      limit,
    };
  } catch (err) {
    // FAIL OPEN on transient Redis errors
    console.error('[RateLimit] Check failed, allowing request:', err);
    return {
      allowed: true,
      remaining: opt.requests,
      resetAt: Date.now() + 60000,
      limit: opt.requests,
      degraded: true,
    };
  }
}

// Preset limiters
export const RateLimits = {
  CHAT: { name: 'chat', requests: 30, window: '1 m' },
  AI_HEAVY: { name: 'ai_heavy', requests: 10, window: '1 m' },
  AUTOPSY: { name: 'autopsy', requests: 5, window: '5 m' },
  AUTH: { name: 'auth', requests: 5, window: '15 m' },
  UPLOAD: { name: 'upload', requests: 10, window: '1 h' },
} as const;
