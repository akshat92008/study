import { beforeEach, describe, expect, it, vi } from 'vitest';
import { assertOwnsAssessment, OwnershipError } from '@/lib/auth/ownership';
import { createAdminClient } from '@/lib/supabase/admin';

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

function mockOwnership(data: any, error: any = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error }),
  };
  (createAdminClient as any).mockReturnValue({ from: vi.fn(() => chain) });
  return chain;
}

describe('ownership helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows owned assessments', async () => {
    mockOwnership({ id: 'assessment-1' });
    await expect(assertOwnsAssessment('user-1', 'assessment-1')).resolves.toBeUndefined();
  });

  it('blocks missing or cross-user assessments', async () => {
    mockOwnership(null);
    await expect(assertOwnsAssessment('user-1', 'assessment-2')).rejects.toBeInstanceOf(OwnershipError);
  });
});
