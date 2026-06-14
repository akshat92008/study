import { describe, expect, it } from 'vitest';
import { buildKeywordFallbackFilter, inferRagMode, isExplicitRagRequest, normalizeChunkText } from '@/lib/rag/retrieval';
import { getSourceGroundingState } from '@/lib/rag/source-grounding';

describe('source-grounded RAG behavior', () => {
  it('distinguishes processing, ready, and failed source states', () => {
    expect(isExplicitRagRequest('Ask me questions from my uploaded PDF.')).toBe(true);
    expect(getSourceGroundingState(['processing'])).toBe('processing');
    expect(getSourceGroundingState(['ready'])).toBe('ready');
    expect(getSourceGroundingState(['failed'])).toBe('failed');
    expect(getSourceGroundingState(['retryable_failed'])).toBe('failed');
    expect(inferRagMode('Ask me questions from my uploaded PDF.', true)).toBe('explicit');
  });

  it('retrieves non-empty text from either legacy column and searches both', () => {
    expect(normalizeChunkText({ text: 'restriction enzyme text', content: null })).toBe('restriction enzyme text');
    expect(normalizeChunkText({ text: null, content: 'PCR source content' })).toBe('PCR source content');
    expect(normalizeChunkText({ text: null, content: null })).toBe('');

    const filter = buildKeywordFallbackFilter(['plasmid', 'polymerase']);
    expect(filter).toContain('content.ilike.%plasmid%');
    expect(filter).toContain('text.ilike.%plasmid%');
    expect(filter).toContain('content.ilike.%polymerase%');
    expect(filter).toContain('text.ilike.%polymerase%');
  });
});

