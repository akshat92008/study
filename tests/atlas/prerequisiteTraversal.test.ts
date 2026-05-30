import { describe, expect, it, vi } from 'vitest';

const links = vi.hoisted(() => [
  {
    source_concept_id: '00000000-0000-0000-0000-00000000000a',
    target_concept_id: '00000000-0000-0000-0000-00000000000b',
  },
  {
    source_concept_id: '00000000-0000-0000-0000-00000000000b',
    target_concept_id: '00000000-0000-0000-0000-00000000000c',
  },
]);

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn((_field: string, value: string) =>
          Promise.resolve({
            data: links.filter((link) => link.target_concept_id === value),
            error: null,
          })
        ),
      })),
    })),
  })),
}));

import { traversePrerequisites } from '@/lib/atlas/prerequisiteTraversal';

describe('traversePrerequisites', () => {
  it('returns ordered prerequisite list for leaf node', async () => {
    const result = await traversePrerequisites('00000000-0000-0000-0000-00000000000c');

    expect(result).toEqual([
      '00000000-0000-0000-0000-00000000000a',
      '00000000-0000-0000-0000-00000000000b',
    ]);
  });

  it('handles cycles gracefully', async () => {
    links.push({
      source_concept_id: '00000000-0000-0000-0000-00000000000c',
      target_concept_id: '00000000-0000-0000-0000-00000000000a',
    });

    const result = await traversePrerequisites('00000000-0000-0000-0000-00000000000c');

    expect(result).toContain('00000000-0000-0000-0000-00000000000a');
    expect(result).toContain('00000000-0000-0000-0000-00000000000b');
  });
});
