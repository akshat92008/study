import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const getUser = vi.hoisted(() => vi.fn());
const checkRateLimit = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser },
  })),
}));

vi.mock('@/lib/middleware/rateLimit', () => ({
  checkRateLimit,
  rateLimitResponse: vi.fn(),
}));

// Mock subsequent database/external calls to prevent full route execution
vi.mock('@/lib/services/chat-persistence', () => ({
  getOrCreateGlobalChatSession: vi.fn(async () => {
    throw new Error('SUCCESSFULLY_PASSED_SCHEMA_VALIDATION');
  }),
}));

describe('Chat Payload Schema Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
    });
    checkRateLimit.mockResolvedValue({
      allowed: true,
      remaining: 29,
      resetAt: new Date(Date.now() + 60000),
    });
  });

  it('rejects completely invalid JSON or malformed schema', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        sessionTurnsCount: 'not-a-number', // invalid type
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_chat_payload');
  });

  it('accepts null values for optional payload fields and proceeds', async () => {
    const { POST } = await import('@/app/api/ai/chat/route');
    const req = new NextRequest('http://localhost/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        message: null,
        content: null,
        text: null,
        input: null,
        prompt: null,
        history: null,
        imageBase64: null,
        imageMimeType: null,
        documentBase64: null,
        documentMimeType: null,
        chatId: null,
        activeGoalId: null,
        sessionTurnsCount: null,
      }),
    });

    // It should pass schema validation and continue into chat context resolution.
    const res = await POST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('invalid_chat_context');
    expect(json.error).not.toBe('invalid_chat_payload');
  });
});
