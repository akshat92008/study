import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  duplicate: null as any,
  insert: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table !== 'revision_cards') throw new Error(`unexpected table ${table}`);
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  is: vi.fn(() => ({
                    maybeSingle: vi.fn(async () => ({ data: state.duplicate, error: null })),
                  })),
                  maybeSingle: vi.fn(async () => ({ data: state.duplicate, error: null })),
                })),
                is: vi.fn(() => ({
                  maybeSingle: vi.fn(async () => ({ data: state.duplicate, error: null })),
                })),
                maybeSingle: vi.fn(async () => ({ data: state.duplicate, error: null })),
              })),
            })),
          })),
        })),
        insert: state.insert,
      };
    }),
  })),
}));

vi.mock('@/lib/services/session-card-cache', () => ({
  invalidateSessionCards: vi.fn(),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('revision card dedupe', () => {
  beforeEach(() => {
    state.duplicate = { id: 'existing-card' };
    state.insert.mockReset();
  });

  it('skips inserting a source-derived duplicate card', async () => {
    const { createSingleCard } = await import('@/lib/engines/revision-engine');

    const result = await createSingleCard(
      'user-1',
      'concept-1',
      'Explain acceleration definition?',
      'Acceleration is rate of change of velocity.',
      'Physics',
      'Motion',
      undefined,
      {
        sourceType: 'session_gap',
        sourceId: 'session-1',
        verified: true,
        confidence: 0.9,
      }
    );

    expect(result).toEqual({ id: 'existing-card' });
    expect(state.insert).not.toHaveBeenCalled();
  });
});
