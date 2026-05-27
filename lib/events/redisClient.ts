// lib/events/redisClient.ts  — full replacement

import { Redis } from '@upstash/redis';

let _client: Redis | null = null;
let _initAttempted = false;

export function getRedisClient(): Redis {
  if (_client) return _client;

  if (_initAttempted) {
    throw new Error('[Redis] Client previously failed to initialize. Check UPSTASH env vars.');
  }

  _initAttempted = true;

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    throw new Error(
      '[Redis] UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN must be set. ' +
      'Get these from your Upstash dashboard.'
    );
  }

  _client = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  return _client;
}

// Optional: safe version that returns null instead of throwing
// Use this in non-critical paths like rate limiting
export function getRedisClientSafe(): Redis | null {
  try {
    return getRedisClient();
  } catch {
    return null;
  }
}