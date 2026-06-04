import { beforeEach, describe, expect, it, vi } from 'vitest';
import { completeOnboardingForUser } from '@/lib/services/onboarding.service';

const getOrCreatePrimaryGoalSession = vi.hoisted(() => vi.fn());

vi.mock('@/lib/services/goal-context.service', () => ({
  GOAL_SELECT: 'id,title,status,metadata,progress',
  getOrCreatePrimaryGoalSession,
}));

function chainFor(result: any) {
  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn((payload) => {
      chain.insertPayload = payload;
      return chain;
    }),
    update: vi.fn((payload) => {
      chain.updatePayload = payload;
      return chain;
    }),
    upsert: vi.fn(async (payload) => {
      chain.upsertPayload = payload;
      return { data: null, error: null };
    }),
    eq: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn(async () => result),
    single: vi.fn(async () => result),
  };
  return chain;
}

function createOnboardingClient(options: {
  existingGoal?: any;
  savedGoal: any;
}) {
  const profileChain = chainFor({ data: null, error: null });
  const existingGoalChain = chainFor({ data: options.existingGoal ?? null, error: null });
  const savedGoalChain = chainFor({ data: options.savedGoal, error: null });
  let learningGoalCalls = 0;

  const supabase = {
    from: vi.fn((table: string) => {
      if (table === 'profiles') return profileChain;
      if (table === 'learning_goals') {
        learningGoalCalls += 1;
        return learningGoalCalls === 1 ? existingGoalChain : savedGoalChain;
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };

  return { supabase, profileChain, savedGoalChain };
}

describe('completeOnboardingForUser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrCreatePrimaryGoalSession.mockResolvedValue({
      id: 'session-1',
      title: 'Primary goal chat',
    });
  });

  it('creates a generic learning goal and marks onboarding complete', async () => {
    const savedGoal = {
      id: 'goal-1',
      title: 'Become fluent in Spanish',
      status: 'active',
      progress: 0,
      metadata: {},
    };
    const { supabase, profileChain, savedGoalChain } = createOnboardingClient({ savedGoal });

    const result = await completeOnboardingForUser({
      supabase,
      user: { id: 'user-1', email: 'learner@example.com', user_metadata: { full_name: 'A Learner' } },
      input: {
        fullName: 'A Learner',
        goalTitle: 'Become fluent in Spanish',
        goalType: 'Language Learning',
        targetDate: '2030-05-01',
        targetScore: null,
        dailyHours: 2,
        currentLevel: 'beginner',
        subjects: [' Spanish ', 'Spanish', 'Grammar'],
        timezone: 'Asia/Kolkata',
      },
    });

    expect(profileChain.upsertPayload).toMatchObject({
      id: 'user-1',
      onboarding_complete: true,
      goal_type: 'Language Learning',
      subjects: ['Spanish', 'Grammar'],
      timezone: 'Asia/Kolkata',
    });
    expect(savedGoalChain.insertPayload).toMatchObject({
      user_id: 'user-1',
      title: 'Become fluent in Spanish',
      subject: 'Spanish',
      domain: 'Language Learning',
      goal_type: 'Language Learning',
      preset_id: 'custom_learning_goal',
      status: 'active',
    });
    expect(savedGoalChain.insertPayload.metadata).toMatchObject({
      source: 'onboarding',
      subjects: ['Spanish', 'Grammar'],
      dailyHours: 2,
      currentLevel: 'beginner',
      timezone: 'Asia/Kolkata',
    });
    expect(getOrCreatePrimaryGoalSession).toHaveBeenCalledWith(supabase, 'user-1', 'goal-1');
    expect(result.createdGoal).toBe(true);
    expect(result.goal).toBe(savedGoal);
  });

  it('updates the existing active goal instead of creating a second primary goal', async () => {
    const existingGoal = {
      id: 'goal-existing',
      progress: 42,
      metadata: { keep: true },
    };
    const savedGoal = {
      id: 'goal-existing',
      title: 'UPSC preparation',
      status: 'active',
      progress: 42,
      metadata: { keep: true },
    };
    const { supabase, savedGoalChain } = createOnboardingClient({ existingGoal, savedGoal });

    const result = await completeOnboardingForUser({
      supabase,
      user: { id: 'user-2', email: 'learner2@example.com' },
      input: {
        goalTitle: 'UPSC preparation',
        goalType: 'Civil Services',
        dailyHours: 3,
        currentLevel: 'intermediate',
        subjects: ['Polity'],
        timezone: 'Not/A-Timezone',
      },
    });

    expect(savedGoalChain.update).toHaveBeenCalledTimes(1);
    expect(savedGoalChain.insert).not.toHaveBeenCalled();
    expect(savedGoalChain.updatePayload).toMatchObject({
      title: 'UPSC preparation',
      progress: 42,
      goal_type: 'Civil Services',
    });
    expect(savedGoalChain.updatePayload.metadata).toMatchObject({
      keep: true,
      source: 'onboarding',
      timezone: 'UTC',
    });
    expect(result.createdGoal).toBe(false);
  });
});
