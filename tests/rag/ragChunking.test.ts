import { describe, expect, it } from 'vitest';
import { chunkExtractedPages, cleanExtractedText } from '@/lib/rag/chunker';

describe('RAG chunking', () => {
  it('cleans text and preserves page metadata on chunks', () => {
    const chunks = chunkExtractedPages({
      pages: [
        {
          pageNumber: 7,
          text: 'ELECTROSTATIC POTENTIAL\n\n' + 'Potential energy depends on charge separation. '.repeat(120),
        },
      ],
      chunkSizeChars: 900,
      overlapChars: 120,
      maxChunks: 8,
    });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].pageStart).toBe(7);
    expect(chunks[0].pageEnd).toBe(7);
    expect(chunks[0].heading).toBe('ELECTROSTATIC POTENTIAL');
    expect(chunks.every((chunk) => chunk.text.length <= 950)).toBe(true);
    expect(new Set(chunks.map((chunk) => chunk.contentHash)).size).toBe(chunks.length);
  });

  it('normalizes noisy whitespace', () => {
    expect(cleanExtractedText('  A   B\r\n\r\n\r\nC  ')).toBe('A B\n\nC');
  });
});
