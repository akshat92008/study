import { NextRequest, NextResponse } from 'next/server';
import { getRedisClientSafe } from '@/lib/events/redisClient';

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

  // If Redis is unavailable, fail open (allow request) — availability > strict limiting
  if (!redis) return { allowed: true, remaining: 99, resetAt: 0 };

  const key = `rl:${config.bucket}:${config.identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - config.windowSeconds;

  // Sliding window using sorted set
  const pipeline = redis.pipeline();
  pipeline.zremrangebyscore(key, 0, windowStart);
  pipeline.zadd(key, { score: now, member: `${now}-${Math.random()}` });
  pipeline.zcard(key);
  pipeline.expire(key, config.windowSeconds);
  const results = await pipeline.exec();

  const count = (results[2]?.[1] as number) ?? (results[2] as unknown as number) ?? 0;
  
  // Depending on ioredis version, pipeline.exec() returns Array<[Error | null, any]>
  // Usually results[2] is [null, count]
  let actualCount = 0;
  if (Array.isArray(results) && results.length > 2) {
      if (Array.isArray(results[2])) {
          actualCount = typeof results[2][1] === 'number' ? results[2][1] : 0;
      } else {
          actualCount = typeof results[2] === 'number' ? results[2] : 0;
      }
  }

  const remaining = Math.max(0, config.maxTokens - actualCount);
  const allowed = actualCount <= config.maxTokens;

  return { allowed, remaining, resetAt: now + config.windowSeconds };
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
