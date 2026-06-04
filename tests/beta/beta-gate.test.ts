import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { enforceBetaSignupGate } from '@/lib/beta/gate';

const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
}));

function mockProfileCount(count: number, error: any = null) {
  const select = vi.fn(async () => ({ data: null, count, error }));
  const from = vi.fn(() => ({ select }));
  createAdminClient.mockReturnValue({ from });
  return { from, select };
}

describe('beta signup gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PUBLIC_BETA_MODE', 'true');
    vi.stubEnv('REQUIRE_INVITE_CODE', 'false');
    vi.stubEnv('MAX_BETA_USERS', '300');
    vi.stubEnv('ADMIN_EMAILS', '');
    vi.stubEnv('BETA_INVITE_CODES', '');
    mockProfileCount(12);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('allows signups when public beta mode is off', async () => {
    vi.stubEnv('PUBLIC_BETA_MODE', 'false');

    await expect(enforceBetaSignupGate({ email: 'new@example.com' })).resolves.toEqual({ allowed: true });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it('requires a valid invite code when configured', async () => {
    vi.stubEnv('REQUIRE_INVITE_CODE', 'true');
    vi.stubEnv('BETA_INVITE_CODES', 'alpha,beta');

    await expect(enforceBetaSignupGate({ email: 'new@example.com' })).resolves.toMatchObject({
      allowed: false,
      reason: expect.stringContaining('invite-only'),
    });
    expect(createAdminClient).not.toHaveBeenCalled();

    await expect(enforceBetaSignupGate({
      email: 'new@example.com',
      inviteCode: 'beta',
    })).resolves.toEqual({ allowed: true });
  });

  it('blocks signups after the beta cohort reaches capacity', async () => {
    vi.stubEnv('MAX_BETA_USERS', '2');
    mockProfileCount(2);

    await expect(enforceBetaSignupGate({ email: 'new@example.com' })).resolves.toMatchObject({
      allowed: false,
      reason: expect.stringContaining('full'),
    });
  });

  it('lets configured admins bypass invite and capacity checks', async () => {
    vi.stubEnv('REQUIRE_INVITE_CODE', 'true');
    vi.stubEnv('MAX_BETA_USERS', '1');
    vi.stubEnv('ADMIN_EMAILS', 'founder@example.com');

    await expect(enforceBetaSignupGate({ email: 'Founder@Example.com' })).resolves.toEqual({ allowed: true });
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});
