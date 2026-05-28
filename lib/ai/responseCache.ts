import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

function hashKey(prompt: string, systemPrompt?: string): string {
  return crypto
    .createHash('sha256')
    .update(`${systemPrompt || ''}\n---\n${prompt}`)
    .digest('hex')
    .slice(0, 32);
}

export async function getCachedResponse(
  prompt: string,
  systemPrompt?: string
): Promise<string | null> {
  if (!redis) return null;
  try {
    const key = `aic:${hashKey(prompt, systemPrompt)}`;
    return (await redis.get(key)) as string | null;
  } catch {
    return null;
  }
}

export async function setCachedResponse(
  prompt: string,
  response: string,
  systemPrompt?: string,
  ttlSeconds = 3600
): Promise<void> {
  if (!redis) return;
  try {
    const key = `aic:${hashKey(prompt, systemPrompt)}`;
    await redis.setex(key, ttlSeconds, response);
  } catch (err) {
    console.warn('[Cache] Set failed:', err);
  }
}

/**
 * Only cache deterministic queries (e.g., concept explanations of well-known topics)
 * NEVER cache personalized responses or anything with user state injected.
 */
export function isCacheable(metadata: { intent?: string; hasUserContext?: boolean }): boolean {
  if (metadata.hasUserContext) return false;
  return ['concept_explanation', 'definition', 'formula'].includes(metadata.intent || '');
}
