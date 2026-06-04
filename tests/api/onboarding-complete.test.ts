import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from '@/app/api/onboarding/complete/route';
import * as serverSupabase from '@/lib/supabase/server';

const completeOnboardingForUser = vi.hoisted(() => vi.fn());

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/services/onboarding.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/services/onboarding.service')>();
  return {
    ...actual,
    completeOnboardingForUser,
  };
});

function mockClient(user: any) {
  const supabase = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user } })),
    },
  };
  vi.mocked(serverSupabase.createClient).mockResolvedValue(supabase as any);
  return supabase;
}

describe('/api/onboarding/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeOnboardingForUser.mockResolvedValue({
      profile: { id: 'user-1', onboardingComplete: true },
      goal: { id: 'goal-1', title: 'Generic learning goal' },
      session: { id: 'session-1' },
      createdGoal: true,
    });
  });

  it('requires an authenticated user', async () => {
    mockClient(null);

    const response = await POST(new NextRequest('http://localhost/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({ goalTitle: 'Learn economics' }),
    }));

    expect(response.status).toBe(401);
    expect(completeOnboardingForUser).not.toHaveBeenCalled();
  });

  it('completes generic onboarding using legacy goal aliases', async () => {
    const supabase = mockClient({
      id: 'user-1',
      email: 'learner@example.com',
      user_metadata: {},
    });

    const response = await POST(new NextRequest('http://localhost/api/onboarding/complete', {
      method: 'POST',
      body: JSON.stringify({
        goal: 'Generic learning goal',
        examType: 'Self Study',
        deadline: '2031-02-03',
        subjects: 'Economics, Economics, Writing',
      }),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      goal: { id: 'goal-1' },
    });
    expect(completeOnboardingForUser).toHaveBeenCalledWith({
      supabase,
      user: expect.objectContaining({ id: 'user-1' }),
      input: expect.objectContaining({
        goalTitle: 'Generic learning goal',
        goalType: 'Self Study',
        targetDate: '2031-02-03',
        subjects: ['Economics', 'Writing'],
      }),
    });
  });
});
