// lib/services/rateLimiter.ts

/**
 * Simple Redis based token bucket rate limiter.
 * Usage example:
 *   const limiter = new RateLimiter(redis, 'api:chat', 10, 60); // 10 requests per 60 seconds
 *   const allowed = await limiter.consume(userId);
 */
import redis from '@/lib/events/redisClient';

export class RateLimiter {
  private readonly keyPrefix: string;
  private readonly maxTokens: number;
  private readonly refillIntervalSec: number;

  constructor(keyPrefix: string, maxTokens: number, refillIntervalSec: number) {
    this.keyPrefix = keyPrefix;
    this.maxTokens = maxTokens;
    this.refillIntervalSec = refillIntervalSec;
  }

  private getKey(identifier: string): string {
    return `${this.keyPrefix}:${identifier}`;
  }

  /**
   * Attempt to consume a single token for the given identifier.
   * Returns true if the request is allowed, false otherwise.
   */
  async consume(identifier: string): Promise<boolean> {
    const key = this.getKey(identifier);
    const now = Date.now();
    const ttl = this.refillIntervalSec * 1000;

    // Use a Lua script to ensure atomicity: refill if needed and then decrement.
    const script = `
      local tokens = tonumber(redis.call('GET', KEYS[1])) or ${this.maxTokens}
      local last = tonumber(redis.call('PTTL', KEYS[1]))
      if last < 0 then
        last = 0
      end
      if last == -1 then
        redis.call('PEXPIRE', KEYS[1], ARGV[2])
      end
      if tokens > 0 then
        tokens = tokens - 1
        redis.call('SET', KEYS[1], tokens, 'PX', ARGV[2])
        return 1
      else
        return 0
      end
    `;
    const result = await redis.eval(script, 1, key, ttl.toString());
    return result === 1;
  }
}
