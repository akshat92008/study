import { describe, expect, it } from 'vitest';
import { buildRagSection } from '@/lib/ai/prompts/mind-prompt';

describe('MIND RAG prompt grounding', () => {
  it('instructs MIND to say not found for explicit source requests without evidence', () => {
    const section = buildRagSection([], {
      mode: 'explicit',
      chunks: [],
      totalContextChars: 0,
      grounded: false,
      evidenceStrength: 'none',
      warnings: [],
      materialIds: [],
      chunkIds: [],
    });

    expect(section).toContain('explicitly asked');
    expect(section).toContain('could not find enough evidence');
  });

  it('formats source snippets with citations when chunks are available', () => {
    const section = buildRagSection([
      {
        content: 'Photosynthesis converts light energy into chemical energy.',
        similarity: 0.91,
        sourceTitle: 'NCERT Biology',
        citation: 'NCERT Biology, p. 42',
      },
    ]);

    expect(section).toContain('[Source 1: NCERT Biology, p. 42]');
    expect(section).toContain('Never invent citations');
  });
});
