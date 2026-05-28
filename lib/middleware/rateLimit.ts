import { NextRequest, NextResponse } from 'next/server';
import { getRedisClientSafe } from '@/lib/events/redisClient';
import { logger } from '@/lib/utils/logger';

interface RateLimitConfig {
  identifier: string;        // e.g. userId or IP
  bucket: string;            // e.g. 'chat', 'autopsy', 'revision'
  maxTokens: number;         // max requests in window
  windowSeconds: number;     // rolling window
}

export async function checkRateLimit(
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const redis = getRedisClientSafe();

  // FAIL OPEN — if Redis is unavailable, allow the request.
  // A Redis outage should not cause a product outage.
  // Monitor logs for '[RateLimit] Redis unavailable' to detect abuse windows.
  if (!redis) {
    logger.warn('[RateLimit] Redis unavailable — failing open. Monitor for abuse.', {
      bucket: config.bucket,
      identifier: config.identifier,
    });
    return { allowed: true, remaining: 1, resetAt: Math.floor(Date.now() / 1000) + 60 };
  }

  const key = `rl:${config.bucket}:${config.identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  try {
    // Sliding window using sorted set
    const pipeline = redis.pipeline();
    pipeline.zremrangebyscore(key, 0, windowStart);
    pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    pipeline.zcard(key);
    pipeline.expire(key, config.windowSeconds);
    const results = await pipeline.exec();

    let actualCount = 0;
    if (Array.isArray(results) && results.length > 2) {
      const res = results as any[];
      if (Array.isArray(res[2])) {
        actualCount = typeof res[2][1] === 'number' ? res[2][1] : 0;
      } else {
        actualCount = typeof res[2] === 'number' ? res[2] : 0;
      }
    }

    const remaining = Math.max(0, config.maxTokens - actualCount);
    const allowed = actualCount <= config.maxTokens;

    return { allowed, remaining, resetAt: now + config.windowSeconds };
  } catch (err) {
    // If the pipeline itself throws (e.g. mid-request Redis failure), fail open.
    logger.warn('[RateLimit] Redis pipeline error — failing open.', { err, bucket: config.bucket });
    return { allowed: true, remaining: 1, resetAt: now + config.windowSeconds };
  }
}

export function rateLimitResponse(remaining: number, resetAt: number): NextResponse {
  return NextResponse.json(
    { error: 'Too many requests. Please slow down.' },
    {
      status: 429,
      headers: {
        'X-RateLimit-Remaining': String(remaining),
        'X-RateLimit-Reset': String(resetAt),
        'Retry-After': String(resetAt - Math.floor(Date.now() / 1000)),
      },
    }
  );
}
