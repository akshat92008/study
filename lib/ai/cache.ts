import { Redis } from "@upstash/redis";
import crypto from "crypto";

const redis = Redis.fromEnv();

const CACHEABLE_INTENTS = new Set([
  "concept_explanation",
  "formula_lookup",
  "definition_query",
]);

function hashKey(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 32);
}

export async function getCachedResponse(
  intent: string,
  message: string,
  exam: string
): Promise<string | null> {
  if (!CACHEABLE_INTENTS.has(intent)) return null;
  
  try {
    const key = `ai:cache:${exam}:${intent}:${hashKey(message.toLowerCase().trim())}`;
    return await redis.get<string>(key);
  } catch {
    return null;
  }
}

export async function setCachedResponse(
  intent: string,
  message: string,
  exam: string,
  response: string
): Promise<void> {
  if (!CACHEABLE_INTENTS.has(intent)) return;
  
  try {
    const key = `ai:cache:${exam}:${intent}:${hashKey(message.toLowerCase().trim())}`;
    await redis.set(key, response, { ex: 60 * 60 * 24 * 7 }); // 7 days
  } catch (e) {
    console.error("[cache] Set failed:", e);
  }
}
