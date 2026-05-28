// lib/services/rateLimiter.ts

/**
 * Simple Redis based token bucket rate limiter.
 * Usage example:
 *   const limiter = RateLimiter.getInstance();
 *   const allowed = await limiter.consume(`chat-${userId}`, 120, 60 * 60 * 1000);
 */
import { getRedisClientSafe } from '@/lib/events/redisClient';

export class RateLimiter {
  private static instance: RateLimiter;

  private constructor() {}

  /** Get the singleton instance */
  static getInstance(): RateLimiter {
    if (!RateLimiter.instance) {
      RateLimiter.instance = new RateLimiter();
    }
    return RateLimiter.instance;
  }

  /**
   * Attempt to consume a token for the given identifier.
   * maxTokens: maximum tokens allowed in the bucket (e.g., 120 requests).
   * windowMs: refill interval in milliseconds (e.g., 60*60*1000 for 1 hour).
   * Returns true if the request is allowed, false otherwise.
   */
  async consume(identifier: string, maxTokens: number, windowMs: number): Promise<boolean> {
    const redis = getRedisClientSafe();
    if (!redis) {
      // If Redis is unconfigured or failed to load, fail open to avoid breaking the app
      return true;
    }

    const key = `rate:${identifier}`;
    const ttl = windowMs; // TTL in ms

    // Lua script implements a token bucket where the key stores remaining tokens.
    // On first hit the key does not exist → we set remaining tokens = maxTokens - 1 and set TTL.
    // On subsequent hits we decrement the token count without resetting TTL.
    const script = `
      local tokens = redis.call('GET', KEYS[1])
      if not tokens then
        redis.call('SET', KEYS[1], ARGV[1] - 1, 'PX', ARGV[2])
        return 1
      end
      tokens = tonumber(tokens)
      if tokens <= 0 then
        return 0
      end
      redis.call('DECR', KEYS[1])
      return 1
    `;

    const result = await redis.eval(script, [key], [maxTokens.toString(), ttl.toString()]);
    return result === 1;
  }
}
