import { describe, expect, it } from 'vitest';
import { inferRagMode } from '@/lib/rag/retrieval';

describe('RAG Final Integration Fixes', () => {
  it('correctly infers explicit mode from keyword variations', () => {
    const explicit1 = inferRagMode('what is cellular respiration based on my notes', true);
    const explicit2 = inferRagMode('explain from my ncert', true);
    
    expect(explicit1).toBe('explicit');
    expect(explicit2).toBe('explicit');
  });

  it('correctly infers implicit mode for study terms', () => {
    const implicit = inferRagMode('generate 5 mcqs about thermodynamics', true);
    expect(implicit).toBe('implicit');
  });

  it('disables RAG when no ready materials exist', () => {
    const explicitNoMats = inferRagMode('explain from my notes', false);
    expect(explicitNoMats).toBe('off');
  });

  // For testing the mind-rag prompt format, it's covered by ragPromptGrounding 
  // but we added explicit handling in buildMindRagContext. We can't easily unit 
  // test the RPC here without a mock DB, but we verified the logic structure.
});
