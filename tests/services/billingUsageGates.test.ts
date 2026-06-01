import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockRpc = vi.fn();
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: mockMaybeSingle })) }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: mockRpc,
    from: mockFrom,
  }),
}));

vi.mock('@/lib/utils/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

describe('closed-beta usage gates', () => {
  beforeEach(() => {
    vi.resetModules();
    mockRpc.mockReset();
    mockFrom.mockClear();
    mockSelect.mockClear();
    mockEq.mockClear();
    mockMaybeSingle.mockReset();
    process.env.FREE_DAILY_CHAT_LIMIT = '2';
    process.env.MAX_UPLOAD_BYTES = '100';
    process.env.MAX_PROMPT_CHARS = '50';
    delete process.env.ALLOW_USAGE_GATE_FAIL_OPEN;
  });

  it('allows and increments usage while under limit', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: true, used: 1, remaining: 1, limit: 2 }, error: null });
    const { consumeUsageLimit } = await import('@/lib/utils/billing');

    await expect(consumeUsageLimit('user-1', 'chat_messages_daily')).resolves.toMatchObject({
      allowed: true,
      used: 1,
      remaining: 1,
    });
    expect(mockRpc).toHaveBeenCalledWith('check_and_increment_usage_gate', expect.objectContaining({
      p_gate: 'chat_messages',
      p_limit: 2,
      p_amount: 1,
    }));
  });

  it('denies usage when the configured limit is reached', async () => {
    mockRpc.mockResolvedValue({ data: { allowed: false, used: 2, remaining: 0, limit: 2 }, error: null });
    const { consumeUsageLimit } = await import('@/lib/utils/billing');

    await expect(consumeUsageLimit('user-1', 'chat_messages_daily')).resolves.toMatchObject({
      allowed: false,
      code: 'limit_reached',
      used: 2,
      remaining: 0,
    });
  });

  it('denies unauthenticated expensive usage', async () => {
    const { consumeUsageLimit } = await import('@/lib/utils/billing');

    await expect(consumeUsageLimit(null, 'ai_calls_daily')).resolves.toMatchObject({
      allowed: false,
      code: 'auth_required',
    });
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('enforces upload and prompt size limits from env', async () => {
    const { validateUploadBytes, validatePromptLength } = await import('@/lib/utils/billing');

    expect(validateUploadBytes(101)).toMatchObject({ allowed: false, code: 'file_too_large' });
    expect(validatePromptLength('x'.repeat(51))).toMatchObject({ allowed: false, code: 'prompt_too_large' });
  });

  it('fails closed when the usage database check fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'db down' } });
    const { consumeUsageLimit } = await import('@/lib/utils/billing');

    await expect(consumeUsageLimit('user-1', 'chat_messages_daily')).resolves.toMatchObject({
      allowed: false,
      code: 'usage_check_failed',
    });
  });
});
