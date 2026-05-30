import { Redis } from '@upstash/redis';
import { logger } from '@/lib/utils/logger';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

const redis = redisUrl && redisToken ? new Redis({ url: redisUrl, token: redisToken }) : null;

export type IdempotencyResult = {
  isDuplicate: boolean;
  error?: string;
};

export async function checkIdempotency(userId: string, route: string, idempotencyKey: string | null): Promise<IdempotencyResult> {
  if (!idempotencyKey) {
    // If no key is provided, we can either enforce it or allow it.
    // For strict security, we should enforce it for expensive routes.
    return { isDuplicate: false, error: 'Idempotency-Key header is required for this operation.' };
  }

  if (!redis) {
    logger.warn('Redis unavailable, skipping idempotency check (fail-open for idempotency to not block legit traffic if rate limit already handles it).');
    return { isDuplicate: false };
  }

  const cacheKey = `idempotency:${userId}:${route}:${idempotencyKey}`;
  
  try {
    const isNew = await redis.set(cacheKey, 'processing', { nx: true, ex: 86400 }); // 24 hours
    
    if (!isNew) {
      return { isDuplicate: true };
    }

    return { isDuplicate: false };
  } catch (error) {
    logger.error('Idempotency check failed', { error });
    // Fail-open for idempotency check itself so we don't drop requests just because Redis is slow, 
    // BUT we rely on the rate limiter (which is fail-closed) to protect us.
    return { isDuplicate: false };
  }
}
