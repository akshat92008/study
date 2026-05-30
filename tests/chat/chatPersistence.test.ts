import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/ai/gemini', () => ({ generateJSON: vi.fn(), getEmbedding: vi.fn() }));
vi.mock('@/lib/ai/router', () => ({
  routeStreamGeneration: vi.fn(),
  routeVisionCall: vi.fn(),
}));
vi.mock('@/lib/events/orchestrator', () => ({ EventDispatcher: { publish: vi.fn() } }));
vi.mock('@/lib/utils/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));

describe('chat persistence helpers', () => {
  it('loads server-side history in chronological order', async () => {
    const { loadRecentMessages } = await import('@/lib/services/chat-persistence');
    const supabase = {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            order: vi.fn(() => ({
              limit: vi.fn(async () => ({
                data: [
                  { role: 'assistant', content: 'second', created_at: '2026-01-02' },
                  { role: 'user', content: 'first', created_at: '2026-01-01' },
                ],
                error: null,
              })),
            })),
          })),
        })),
      })),
    };

    await expect(loadRecentMessages(supabase, 'session-1')).resolves.toEqual([
      { role: 'user', content: 'first' },
      { role: 'assistant', content: 'second' },
    ]);
  });

  it('persists user and assistant messages against the global session', async () => {
    const { persistChatMessage } = await import('@/lib/services/chat-persistence');
    const inserted: any[] = [];
    const updated: any[] = [];
    const supabase = {
      from: vi.fn((table: string) => ({
        insert: vi.fn(async (row: any) => {
          inserted.push({ table, row });
          return { error: null };
        }),
        update: vi.fn((row: any) => {
          updated.push({ table, row });
          return {
            eq: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })),
          };
        }),
      })),
    };

    await persistChatMessage(supabase, {
      sessionId: 'global-session',
      userId: 'user-1',
      role: 'user',
      content: 'hello',
    });
    await persistChatMessage(supabase, {
      sessionId: 'global-session',
      userId: 'user-1',
      role: 'assistant',
      content: 'hi',
    });

    expect(inserted.map((x) => x.row.role)).toEqual(['user', 'assistant']);
    expect(inserted.every((x) => x.row.session_id === 'global-session')).toBe(true);
    expect(updated).toHaveLength(2);
  });
});
