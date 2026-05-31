import { beforeEach, describe, expect, it, vi } from 'vitest';

const publish = vi.hoisted(() => vi.fn());
const getUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));

vi.mock('@/lib/events/orchestrator', () => ({
  EventDispatcher: { publish },
}));

describe('/api/events public publisher', () => {
  beforeEach(() => {
    publish.mockReset();
    getUser.mockReset();
    getUser.mockResolvedValue({
      data: { user: { id: '00000000-0000-0000-0000-000000000001' } },
    });
  });

  it('rejects browser-origin internal event types before enqueueing', async () => {
    const { POST } = await import('@/app/api/events/route');

    const res = await POST(new Request('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        type: 'CHAT_MESSAGE_PROCESSED',
        data: {
          sessionId: 'session-1',
          message: 'hello',
          fullResponse: 'hi',
        },
      }),
    }));

    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({
      error: 'event_not_publishable',
      message: 'Event type is not client-publishable.',
    });
    expect(publish).not.toHaveBeenCalled();
  });
});
