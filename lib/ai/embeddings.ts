import { routeEmbedding, type EmbeddingBudgetOptions } from './router';

export async function getEmbedding(
  text: string,
  budgetOptions?: EmbeddingBudgetOptions
): Promise<number[] | null> {
  if (process.env.DISABLE_EMBEDDINGS === "true") {
    return null; // explicit opt-out
  }
  
  if (!text || text.trim().length < 3) return null;
  
  try {
    const result = await routeEmbedding(text.slice(0, 8000), budgetOptions);
    return result ?? null;
  } catch (e) {
    console.error("[embeddings] Failed:", e);
    return null; // graceful degradation, don't crash callers
  }
}

export async function getEmbeddingsBatch(
  texts: string[],
  concurrency = 5,
  budgetOptions?: EmbeddingBudgetOptions
): Promise<(number[] | null)[]> {
  if (process.env.DISABLE_EMBEDDINGS === "true") {
    return texts.map(() => null);
  }
  
  const results: (number[] | null)[] = new Array(texts.length).fill(null);
  
  // Process in batches to avoid overwhelming the provider
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchPromises = batch.map((text, idx) => 
      getEmbedding(text, budgetOptions).then(emb => {
        results[i + idx] = emb;
      })
    );
    await Promise.all(batchPromises);
  }
  
  return results;
}
