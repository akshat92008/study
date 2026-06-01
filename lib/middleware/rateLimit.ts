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
const limiters: Record<string, Ratelimit> = {};

function shouldFailClosed(_requested?: boolean): boolean {
  return process.env.NODE_ENV === 'production';
}

function shouldBypassNetworkRateLimitForTests(): boolean {
  return (
    (process.env.NODE_ENV === 'test' || process.env.VITEST === 'true') &&
    process.env.ENABLE_NETWORK_RATE_LIMIT_TESTS !== 'true'
  );
}

function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) {
      console.warn('[RateLimit] Upstash credentials missing');
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
    {
      error: 'rate_limited',
      message: 'Too many requests, please slow down.',
    },
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
  identifierOrOptions: string | { identifier: string; bucket: string; maxTokens: number; windowSeconds: number; failClosed?: boolean },
  options?: {
    name: string;
    requests: number;
    window: string;
    failClosed?: boolean;
  }
): Promise<RateLimitResult> {
  let id: string;
  let opt: { name: string; requests: number; window: string; failClosed?: boolean };

  if (typeof identifierOrOptions === 'string') {
    id = identifierOrOptions;
    opt = options!;
  } else {
    id = identifierOrOptions.identifier;
    opt = {
      name: identifierOrOptions.bucket,
      requests: identifierOrOptions.maxTokens,
      window: `${identifierOrOptions.windowSeconds} s`,
      failClosed: identifierOrOptions.failClosed,
    };
  }

  if (shouldBypassNetworkRateLimitForTests()) {
    return {
      allowed: true,
      remaining: opt.requests,
      resetAt: Date.now() + 60000,
      limit: opt.requests,
      degraded: true,
    };
  }

  const limiter = getLimiter(opt.name, opt.requests, opt.window);
  
  // Daily cap for heavy routes (abuse prevention)
  const isHeavy = ['chat', 'autopsy', 'planner', 'revision', 'atlas'].includes(opt.name);
  const dailyLimiter = isHeavy ? getLimiter(`${opt.name}_daily`, 200, '86400 s') : null;

  if (!limiter) {
    if (shouldFailClosed(opt.failClosed)) {
      return { allowed: false, remaining: 0, resetAt: Date.now() + 60000, limit: opt.requests, degraded: true };
    }
    return { allowed: true, remaining: opt.requests, resetAt: Date.now() + 60000, limit: opt.requests, degraded: true };
  }

  try {
    if (dailyLimiter) {
      const dailyRes = await dailyLimiter.limit(id);
      if (!dailyRes.success) {
        Metrics.rateLimitHit(`${opt.name}_daily`, id);
        return { allowed: false, remaining: 0, resetAt: dailyRes.reset, limit: 200 };
      }
    }

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
    console.error('[RateLimit] Check failed:', err);
    if (shouldFailClosed(opt.failClosed)) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: Date.now() + 60000,
        limit: opt.requests,
        degraded: true,
      };
    }
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
