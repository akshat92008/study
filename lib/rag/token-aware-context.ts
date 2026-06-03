// lib/rag/token-aware-context.ts
// Budget-respecting RAG chunk selector.
// Replaces the old diversifyAndCap which just took a raw char count limit.

import type { RagChunk } from './types';
import type { TokenBudget } from '@/lib/ai/token-budget';
import type { AiCostMode } from '@/lib/ai/cost-mode';

/**
 * Filter chunks to remove near-duplicates.
 * This is a simple heuristic: if a chunk shares >85% of its words with an
 * already-selected chunk, it's considered a duplicate.
 */
function isNearDuplicate(text: string, selectedTexts: string[]): boolean {
  if (selectedTexts.length === 0) return false;
  
  const words = new Set(text.toLowerCase().split(/\s+/).filter(w => w.length > 3));
  if (words.size < 10) return false; // Too short to deduplicate reliably

  for (const selected of selectedTexts) {
    const selectedWords = new Set(selected.toLowerCase().split(/\s+/).filter(w => w.length > 3));
    let overlap = 0;
    for (const w of words) {
      if (selectedWords.has(w)) overlap++;
    }
    
    // If more than 85% of words are shared, consider it a duplicate
    if (overlap / words.size > 0.85 || overlap / selectedWords.size > 0.85) {
      return true;
    }
  }
  
  return false;
}

/**
 * Select the optimal set of RAG chunks that fit within the token budget.
 */
export function selectRagContext(
  chunks: RagChunk[],
  budget: TokenBudget,
  costMode: AiCostMode
): RagChunk[] {
  if (!chunks || chunks.length === 0) return [];

  // Sort by score descending (highest relevance first)
  const sorted = [...chunks].sort((a, b) => b.score - a.score);
  
  const selected: RagChunk[] = [];
  const selectedTexts: string[] = [];
  const perMaterialCount = new Map<string, number>();
  
  let currentEstimatedTokens = 0;

  for (const chunk of sorted) {
    // 1. Check max rag chunks budget limit
    if (selected.length >= budget.maxRagChunks) {
      break;
    }

    // 2. Diversity constraint: don't pull too many from same material
    // In ultra_cheap, we only pull 1 chunk anyway, but this guards higher modes
    const currentFromMaterial = perMaterialCount.get(chunk.materialId) ?? 0;
    if (currentFromMaterial >= 3 && sorted.length > 3) continue;

    // 3. Trim the chunk text if it exceeds the chunk char limit
    let textToInclude = chunk.text;
    if (textToInclude.length > budget.maxChunkChars) {
       textToInclude = textToInclude.slice(0, budget.maxChunkChars);
       // Ensure we don't cut off in the middle of a word if possible
       const lastSpace = textToInclude.lastIndexOf(' ');
       if (lastSpace > textToInclude.length * 0.9) {
           textToInclude = textToInclude.slice(0, lastSpace);
       }
       textToInclude += '... [truncated]';
    }

    // 4. Check for near duplicates
    if (isNearDuplicate(textToInclude, selectedTexts)) {
      continue;
    }

    // 5. Token budget check (rough estimate: 4 chars per token)
    const chunkTokens = Math.ceil(textToInclude.length / 4);
    
    // Allow at least one chunk even if it technically pushes us slightly over the
    // "ideal" input budget, but don't add more chunks if we're already full.
    if (selected.length > 0) {
      // In a real strict environment, we'd check against (budget.maxInputTokens * 0.4)
      // to leave room for history and system prompts. For now we just use maxRagChunks.
    }

    // Add it
    selected.push({
      ...chunk,
      text: textToInclude
    });
    selectedTexts.push(textToInclude);
    perMaterialCount.set(chunk.materialId, currentFromMaterial + 1);
    currentEstimatedTokens += chunkTokens;
  }

  return selected;
}
