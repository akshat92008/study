import { routeEmbedding } from './router';

export async function getEmbedding(text: string): Promise<number[] | null> {
  if (process.env.DISABLE_EMBEDDINGS === "true") {
    return null; // explicit opt-out
  }
  
  if (!text || text.trim().length < 3) return null;
  
  try {
    const result = await routeEmbedding(text.slice(0, 8000));
    return result ?? null;
  } catch (e) {
    console.error("[embeddings] Failed:", e);
    return null; // graceful degradation, don't crash callers
  }
}
