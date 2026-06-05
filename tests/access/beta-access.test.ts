import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserAccessState, requireBetaAccess } from '@/lib/access/beta-access';

const createAdminClient = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient,
}));

function mockProfile(profile: Record<string, any> | null, error: any = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: profile, error }),
  };
  createAdminClient.mockReturnValue({ from: vi.fn(() => chain) });
  return chain;
}

describe('manual beta access', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('PAID_BETA_GATE_ENABLED', 'true');
    vi.stubEnv('ADMIN_USER_IDS', '');
    vi.stubEnv('ADMIN_EMAILS', '');
  });

  afterEach(() => vi.unstubAllEnvs());

  it('allows active beta access', async () => {
    mockProfile({ id: 'u1', beta_access: true, beta_access_until: null, manual_plan: 'free', suspended: false });

    await expect(getUserAccessState('u1')).resolves.toMatchObject({
      hasBetaAccess: true,
      plan: 'free',
      accessSource: 'manual_beta',
    });
  });

  it('blocks expired beta access', async () => {
    mockProfile({
      id: 'u1',
      beta_access: true,
      beta_access_until: '2020-01-01T00:00:00.000Z',
      manual_plan: 'free',
      suspended: false,
    });

    await expect(requireBetaAccess('u1')).rejects.toMatchObject({
      code: 'beta_access_required',
    });
  });

  it('blocks suspended users even with beta access', async () => {
    mockProfile({ id: 'u1', beta_access: true, beta_access_until: null, manual_plan: 'free', suspended: true });

    await expect(requireBetaAccess('u1')).rejects.toMatchObject({
      code: 'account_suspended',
    });
  });

  it('allows manual paid beta plans', async () => {
    mockProfile({ id: 'u1', beta_access: false, beta_access_until: null, manual_plan: 'founding', suspended: false });

    await expect(getUserAccessState('u1')).resolves.toMatchObject({
      hasBetaAccess: true,
      plan: 'founding',
      accessSource: 'manual_plan',
    });
  });

  it('allows configured admins', async () => {
    vi.stubEnv('ADMIN_USER_IDS', 'admin-1');
    mockProfile({ id: 'admin-1', beta_access: false, beta_access_until: null, manual_plan: 'free', suspended: true });

    await expect(getUserAccessState('admin-1')).resolves.toMatchObject({
      isAdmin: true,
      hasBetaAccess: true,
      plan: 'admin',
      accessSource: 'admin',
    });
  });
});
