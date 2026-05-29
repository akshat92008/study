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

import { createClient } from '@/lib/supabase/server';
import { getEmbedding } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';

export async function checkSemanticCache(prompt: string): Promise<string | null> {
  try {
    const trimmed = prompt.trim();
    if (trimmed.length < 15 || trimmed.length > 500) {
      logger.info('Semantic cache rejected: length out of bounds');
      return null; // Only cache moderately sized specific queries
    }

    const embedding = await getEmbedding(trimmed);
    if (!embedding || embedding.length === 0) {
      logger.info('Semantic cache miss: empty embedding');
      return null;
    }

    const supabase = await createClient();
    const { data, error } = await supabase.rpc('match_semantic_cache', {
      query_embedding: `[${embedding.join(',')}]`,
      match_threshold: 0.95, // High threshold to ensure semantic equivalence
      match_count: 1
    });

    if (!error && data && data.length > 0) {
      logger.info(`Semantic cache hit: id=${data[0].id}`);
      // Update access count and timestamp asynchronously
      supabase.rpc('increment_cache_access', { cache_id: data[0].id })
        .then(({ error }: any) => {
          if (error) logger.warn('Failed to increment cache access', error);
        });
      return data[0].response_text;
    } else {
      if (error) logger.error('match_semantic_cache RPC failed', error);
      else logger.info('Semantic cache miss: no semantic matches above threshold');
    }
  } catch (err) {
    logger.warn('Semantic cache check failed', err);
  }
  return null;
}

export async function setSemanticCache(prompt: string, response: string): Promise<void> {
  try {
    const trimmed = prompt.trim();
    if (trimmed.length < 15 || trimmed.length > 500) return;

    const embedding = await getEmbedding(trimmed);
    if (!embedding || embedding.length === 0) return;

    const supabase = await createClient();
    const hash = crypto.createHash('sha256').update(trimmed).digest('hex');

    await supabase.from('semantic_cache').upsert({
      prompt_hash: hash,
      prompt_text: trimmed,
      response_text: response,
      embedding: `[${embedding.join(',')}]`,
    }, { onConflict: 'prompt_hash' });
  } catch (err) {
    logger.warn('Semantic cache set failed', err);
  }
}

/**
 * Only cache deterministic queries (e.g., concept explanations of well-known topics)
 * NEVER cache personalized responses or anything with user state injected.
 */
export function isCacheable(metadata: { intent?: string; hasUserContext?: boolean }): boolean {
  if (metadata.hasUserContext) {
    logger.info('Semantic cache rejected: unsafe personalization detected (hasUserContext=true)');
    return false;
  }
  
  const cacheable = ['concept_explanation', 'definition', 'formula'].includes(metadata.intent || '');
  if (!cacheable) {
    logger.info(`Semantic cache rejected: intent '${metadata.intent || 'none'}' is not cacheable`);
  }
  
  return cacheable;
}
