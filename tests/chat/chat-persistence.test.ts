import { describe, it, expect, vi, beforeEach } from 'vitest';
import { persistChatMessage } from '@/lib/services/chat-persistence';
import * as serverAdmin from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Chat Persistence Tests', () => {
  const adminClientMock = {
    from: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    then: vi.fn((resolve) => resolve({ data: null, error: null })),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverAdmin.createAdminClient).mockReturnValue(adminClientMock as any);
  });

  it('persists user message properly', async () => {
    adminClientMock.single.mockResolvedValueOnce({ data: { id: 'msg-1' }, error: null });

    const result = await persistChatMessage(adminClientMock, {
      sessionId: 'session-1',
      userId: 'user-123',
      role: 'user',
      content: 'Hello there'
    });
    
    expect(result.id).toBe('msg-1');
    expect(adminClientMock.insert).toHaveBeenCalledWith(expect.objectContaining({
      session_id: 'session-1',
      user_id: 'user-123',
      role: 'user',
      content: 'Hello there'
    }));
  });

  it('persists assistant response properly', async () => {
    adminClientMock.single.mockResolvedValueOnce({ data: { id: 'msg-2' }, error: null });

    const result = await persistChatMessage(adminClientMock, {
      sessionId: 'session-1',
      userId: 'user-123',
      role: 'assistant',
      content: 'How can I help?'
    });
    
    expect(result.id).toBe('msg-2');
    expect(adminClientMock.insert).toHaveBeenCalledWith(expect.objectContaining({
      session_id: 'session-1',
      user_id: 'user-123',
      role: 'assistant',
      content: 'How can I help?'
    }));
  });
});
