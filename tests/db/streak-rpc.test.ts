import { describe, expect, it, vi, beforeEach } from 'vitest';
import { computeAndUpdateStreak } from '@/lib/engines/streak-engine';
import * as supabaseServer from '@/lib/supabase/server';

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

describe('computeAndUpdateStreak', () => {
  let mockSupabase: any;
  let mockProfile: any;
  let updateSpy: any;

  beforeEach(() => {
    mockProfile = {
      id: 'user-1',
      streak_days: 0,
      last_active_at: null,
    };

    updateSpy = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({}) });

    mockSupabase = {
      from: vi.fn().mockImplementation((table) => {
        if (table === 'profiles') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: mockProfile }),
              }),
            }),
            update: updateSpy,
          };
        }
        return {};
      }),
    };

    (supabaseServer.createClient as any).mockResolvedValue(mockSupabase);
  });

  const getToday = () => new Date().toISOString().split('T')[0];
  const getYesterday = () => new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const getTwoDaysAgo = () => new Date(Date.now() - 86400000 * 2).toISOString().split('T')[0];

  it('New user completes first study session today -> streak_days becomes 1', async () => {
    mockProfile.streak_days = 0;
    mockProfile.last_active_at = null;

    const streak = await computeAndUpdateStreak('user-1');
    expect(streak).toBe(1);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ streak_days: 1 }));
  });

  it('Same user completes another session same day -> streak_days stays 1', async () => {
    mockProfile.streak_days = 1;
    mockProfile.last_active_at = new Date().toISOString(); // Active today

    const streak = await computeAndUpdateStreak('user-1');
    expect(streak).toBe(1);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ streak_days: 1 }));
  });

  it('User completes next day -> streak_days becomes 2', async () => {
    mockProfile.streak_days = 1;
    // Set last active to yesterday
    mockProfile.last_active_at = `${getYesterday()}T10:00:00.000Z`;

    const streak = await computeAndUpdateStreak('user-1');
    expect(streak).toBe(2);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ streak_days: 2 }));
  });

  it('User misses a day then completes -> streak_days resets to 1', async () => {
    mockProfile.streak_days = 2;
    // Set last active to 2 days ago
    mockProfile.last_active_at = `${getTwoDaysAgo()}T10:00:00.000Z`;

    const streak = await computeAndUpdateStreak('user-1');
    expect(streak).toBe(1);
    expect(updateSpy).toHaveBeenCalledWith(expect.objectContaining({ streak_days: 1 }));
  });
});
