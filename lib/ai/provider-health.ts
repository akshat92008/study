// lib/ai/provider-health.ts

import { Redis } from '@upstash/redis';

// Lazy init — only crashes if actually used, not at import time (fixes BUG 4 too)
let _redis: Redis | null = null;
function getRedis(): Redis | null {
  if (_redis) return _redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null; // degrade gracefully — health tracking disabled
  }
  _redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return _redis;
}

export interface ProviderHealth {
  failCount: number;
  lastFailure: number; // unix ms
  cooldownMs: number;
}

const HEALTH_TTL_SECONDS = 300; // 5 minutes — matches typical cooldown window

export async function getProviderHealth(providerId: string): Promise<ProviderHealth> {
  const redis = getRedis();
  if (!redis) return { failCount: 0, lastFailure: 0, cooldownMs: 0 };

  try {
    const raw = await redis.get<ProviderHealth>(`provider:health:${providerId}`);
    return raw ?? { failCount: 0, lastFailure: 0, cooldownMs: 0 };
  } catch {
    return { failCount: 0, lastFailure: 0, cooldownMs: 0 };
  }
}

export async function recordProviderFailure(
  providerId: string,
  cooldownMs: number
): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  const current = await getProviderHealth(providerId);
  const updated: ProviderHealth = {
    failCount: current.failCount + 1,
    lastFailure: Date.now(),
    cooldownMs,
  };

  try {
    await redis.set(`provider:health:${providerId}`, updated, { ex: HEALTH_TTL_SECONDS });
  } catch {
    // non-fatal — health tracking degrades to in-memory
  }
}

export async function resetProviderHealth(providerId: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`provider:health:${providerId}`);
  } catch {}
}

export async function isProviderInCooldown(providerId: string): Promise<boolean> {
  const health = await getProviderHealth(providerId);
  if (health.failCount === 0) return false;
  return Date.now() - health.lastFailure < health.cooldownMs;
}

export async function getAllProviderStats(): Promise<Record<string, ProviderHealth>> {
  const providers = ['cerebras', 'sambanova', 'groq_compound', 'groq_gemma', 'cloudflare', 'google'];
  const stats: Record<string, ProviderHealth> = {};
  for (const p of providers) {
    stats[p] = await getProviderHealth(p);
  }
  return stats;
}
