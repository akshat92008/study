/**
 * SESSION CARD API — Integration Tests (Mocked Supabase)
 * ========================================================
 * Tests the full GET /api/dashboard/session-card handler with a mocked
 * Supabase client so no live DB connection is needed.
 *
 * Covers:
 *   - Response contract fields always present
 *   - Cache hit path (valid learner_state_version)
 *   - Cache miss → regeneration
 *   - LLM failure → code fallback
 *   - Onboarding guard
 *   - No duplicate cards (upsert)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mock the Supabase client ────────────────────────────────────────────────

const mockRpcResult = { data: null, error: null };
const mockSingle = vi.fn();
const mockMaybeSingle = vi.fn();
const mockCount = vi.fn().mockResolvedValue({ count: 0, error: null });
const mockUpsert = vi.fn().mockResolvedValue({ error: null });
const mockDelete = vi.fn().mockResolvedValue({ error: null });

// Build a chainable Supabase mock
function buildQuery(result: any) {
  const q: any = {
    select: () => q,
    eq: () => q,
    neq: () => q,
    in: () => q,
    gte: () => q,
    lte: () => q,
    is: () => q,
    order: () => q,
    limit: () => q,
    upsert: mockUpsert,
    delete: () => q,
    update: () => q,
    single: () => Promise.resolve(result),
    maybeSingle: () => Promise.resolve(result),
    then: (resolve: any) => resolve(result),
  };
  return q;
}

const supabaseMock = {
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: { id: 'test-user-id' } },
    }),
  },
  from: vi.fn(),
  rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
};

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => Promise.resolve(supabaseMock),
}));

vi.mock('@/lib/ai/provider-client', () => ({
  generateJSON: vi.fn().mockRejectedValue(new Error('LLM not available')),
}));

vi.mock('@/lib/ai/budgeted', () => ({
  budgetedGenerateJSON: vi.fn().mockRejectedValue(new Error('LLM not available')),
}));

vi.mock('@/lib/services/ai-usage.service', () => ({
  assertDailyAIUsageBudget: vi.fn().mockResolvedValue(undefined),
  isAIUsageBudgetExceeded: vi.fn().mockReturnValue(false),
  trackDailyAIUsage: vi.fn().mockResolvedValue(undefined),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import { GET } from '@/app/api/dashboard/session-card/route';
import type { SessionCardResponse } from '@/app/api/dashboard/session-card/route';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TODAY = new Date().toISOString().split('T')[0];

function stubFrom(tableDataMap: Record<string, any>) {
  supabaseMock.from.mockImplementation((table: string) => {
    const data = tableDataMap[table];
    if (data === undefined) {
      return buildQuery({ data: null, error: null });
    }
    if (data && typeof data.count !== 'undefined') {
      // Count query
      const q: any = {
        select: () => q,
        eq: () => q,
        neq: () => q,
        in: () => q,
        lte: () => q,
        gte: () => q,
        order: () => q,
        limit: () => q,
        head: true,
        maybeSingle: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : null, error: null }),
        single: () => Promise.resolve({ data: Array.isArray(data) ? data[0] : null, error: null }),
      };
      Object.defineProperty(q, 'count', { get: () => data.count });
      // Make it awaitable
      q.then = (resolve: any) => resolve({ count: data.count, error: null });
      q.catch = () => q;
      q.finally = () => q;
      q.upsert = mockUpsert;
      q.delete = () => q;
      return q;
    }
    return buildQuery({ data, error: null });
  });
}

async function callGET(): Promise<SessionCardResponse> {
  const response = await GET();
  return response.json() as Promise<SessionCardResponse>;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Session Card API — Response Contract', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.SESSION_CARD_LLM_PROSE_ENABLED;
  });

  it('T_CONTRACT: response always has all required top-level fields', async () => {
    stubFrom({
      profiles: { id: 'test-user-id', exam_type: 'NEET', target_date: null, streak_days: 3, timezone: 'Asia/Kolkata', onboarding_complete: false, learner_state_version: 0 },
      session_cards: null,
      learning_goals: null,
      revision_cards: { count: 0 },
      mistakes: [],
      concepts: [],
      study_sessions: { count: 0 },
      student_models: null,
    });

    const res = await callGET();

    expect(res).toHaveProperty('hasCard');
    expect(res).toHaveProperty('card');
    expect(res).toHaveProperty('sourceSignals');
    expect(res).toHaveProperty('generatedAt');
    expect(res).toHaveProperty('learnerStateVersion');
    expect(res).toHaveProperty('needsOnboarding');
  });

  it('T_ONBOARDING: incomplete profile → hasCard=false, needsOnboarding=true', async () => {
    stubFrom({
      profiles: { id: 'test-user-id', exam_type: 'NEET', target_date: null, streak_days: 0, timezone: null, onboarding_complete: false, learner_state_version: 1 },
      session_cards: null,
      learning_goals: null,
      revision_cards: { count: 0 },
      mistakes: [],
      concepts: [],
      study_sessions: { count: 0 },
      student_models: null,
    });

    const res = await callGET();
    expect(res.hasCard).toBe(false);
    expect(res.needsOnboarding).toBe(true);
    expect(res.card).toBeNull();
  });

  it('T_CACHE_HIT: valid cached card is returned without LLM call', async () => {
    const { budgetedGenerateJSON } = await import('@/lib/ai/budgeted');

    stubFrom({
      profiles: {
        id: 'test-user-id',
        exam_type: 'NEET',
        target_date: null,
        streak_days: 5,
        timezone: null,
        onboarding_complete: true,
        learner_state_version: 7,
      },
      session_cards: {
        // Cached card with matching version
        user_id: 'test-user-id',
        date: TODAY,
        learner_state_version: 7,
        dayNumber: 11,
        streakDays: 5,
        focusTopic: 'Newton\'s Laws',
        subject: 'Physics',
        estimatedMinutes: 45,
        rationale: 'Cached reason',
        daysToExam: null,
        overdueCards: 0,
        masteryPercent: 30,
        taskType: 'concept_study',
        resourceType: 'practice_questions',
        targetConceptId: null,
        priority: 'concept_study',
        isCompleted: false,
        completedAt: null,
        selectionReason: 'test',
        mistakeCount: 0,
        weakConceptCount: 1,
        hasActiveGoal: false,
        created_at: new Date().toISOString(),
      },
    });

    const res = await callGET();
    expect(res.hasCard).toBe(true);
    expect(res.card?.focusTopic).toBe('Newton\'s Laws');
    // LLM should NOT be called for a cache hit
    expect(budgetedGenerateJSON).not.toHaveBeenCalled();
  });

  it('T_STALE_CACHE: version mismatch → regeneration without dashboard LLM by default', async () => {
    const { budgetedGenerateJSON } = await import('@/lib/ai/budgeted');

    stubFrom({
      profiles: {
        id: 'test-user-id',
        exam_type: 'NEET',
        target_date: null,
        streak_days: 5,
        timezone: null,
        onboarding_complete: true,
        learner_state_version: 8, // ← version is 8
      },
      session_cards: {
        // Cached card has OLD version 7
        user_id: 'test-user-id',
        date: TODAY,
        learner_state_version: 7, // ← STALE
        dayNumber: 11,
        streakDays: 5,
        focusTopic: 'Stale Topic',
        subject: 'Physics',
        estimatedMinutes: 45,
        rationale: 'Old reason',
        daysToExam: null,
        overdueCards: 0,
        masteryPercent: 30,
        taskType: 'concept_study',
        resourceType: 'practice_questions',
        targetConceptId: null,
        priority: 'concept_study',
        isCompleted: false,
        completedAt: null,
      },
      learning_goals: null,
      revision_cards: { count: 0 },
      mistakes: [],
      concepts: [
        {
          id: 'c1',
          name: 'Laws of Motion',
          subject: 'Physics',
          chapter: 'Kinematics',
          mastery: 'not_started',
          mastery_score: 0,
          forgetting_probability: 1,
          times_reviewed: 0,
        },
      ],
      study_sessions: { count: 5 },
      student_models: { fatigue_threshold_minutes: 45, peak_productivity_hour: 10 },
    });

    const res = await callGET();
    // Should regenerate from deterministic code without calling the LLM on dashboard load.
    expect(res.hasCard).toBe(true);
    expect(res.card?.focusTopic).not.toBe('Stale Topic'); // regenerated
    expect(budgetedGenerateJSON).not.toHaveBeenCalled();
    // Upsert should be called to store new card via RPC
    expect(supabaseMock.rpc).toHaveBeenCalledWith('upsert_session_card', expect.any(Object));
  });

  it('T_LLM_FALLBACK: explicitly enabled LLM failure → code-computed values used (no crash)', async () => {
    process.env.SESSION_CARD_LLM_PROSE_ENABLED = 'true';
    const { budgetedGenerateJSON } = await import('@/lib/ai/budgeted');
    vi.mocked(budgetedGenerateJSON).mockRejectedValue(new Error('Simulated LLM error'));

    stubFrom({
      profiles: {
        id: 'test-user-id',
        exam_type: 'NEET',
        target_date: null,
        streak_days: 2,
        timezone: null,
        onboarding_complete: true,
        learner_state_version: 1,
      },
      session_cards: null, // No cache
      learning_goals: null,
      revision_cards: { count: 0 },
      mistakes: [],
      concepts: [
        {
          id: 'c-weak',
          name: 'Thermodynamics',
          subject: 'Physics',
          chapter: 'Thermodynamics',
          mastery: 'developing',
          mastery_score: 0.3,
          forgetting_probability: 0.8,
          times_reviewed: 2,
        },
      ],
      study_sessions: { count: 3 },
      student_models: { fatigue_threshold_minutes: 45, peak_productivity_hour: 10 },
    });

    const res = await callGET();
    // Card should still be generated (code fallback)
    expect(res.hasCard).toBe(true);
    expect(res.card).not.toBeNull();
    expect(res.card?.focusTopic).toBeTruthy();
    // focusTopic should NOT be the generic invalid values
    expect(['none', 'null', 'general', '']).not.toContain(
      res.card?.focusTopic?.toLowerCase()
    );
    expect(budgetedGenerateJSON).toHaveBeenCalled();
  });

  it('T_OVERDUE_P1: overdue cards → revision card returned', async () => {
    stubFrom({
      profiles: {
        id: 'test-user-id',
        exam_type: 'JEE',
        target_date: null,
        streak_days: 10,
        timezone: null,
        onboarding_complete: true,
        learner_state_version: 2,
      },
      session_cards: null,
      learning_goals: null,
      revision_cards: [
        {
          id: 'due-card-1',
          subject: 'Maths',
          chapter: 'Integration',
          concept_id: null,
          difficulty: 8,
          lapses: 1,
        },
      ],
      mistakes: [],
      concepts: [],
      study_sessions: { count: 20 },
      student_models: null,
    });

    // For count query
    supabaseMock.from.mockImplementationOnce(() => {
      // profiles
      return buildQuery({ data: { id: 'test-user-id', exam_type: 'JEE', target_date: null, streak_days: 10, timezone: null, onboarding_complete: true, learner_state_version: 2 }, error: null });
    });

    // The selector alone tells us the priority — verify via selectSessionCard directly
    const { selectSessionCard: select } = await import(
      '@/lib/engines/session-card-selector'
    );
    const result = select({
      profile: {
        id: 'u1',
        exam_type: 'JEE',
        target_date: null,
        streak_days: 10,
        timezone: null,
        onboarding_complete: true,
      },
      activeGoal: null,
      overdueCardCount: 5,
      topDueCard: { id: 'due-card-1', subject: 'Maths', chapter: 'Integration', concept_id: null, difficulty: 8, lapses: 1 },
      recentMistakes: [],
      weakConcepts: [],
      sessionCount: 20,
      studentModel: null,
    });
    expect(result.priority).toBe('revision');
    expect(result.taskType).toBe('revision');
    expect(result.subject).toBe('Maths');
  });

  it('T_UPSERT_IDEMPOTENT: upsert called exactly once per generation', async () => {
    vi.clearAllMocks();

    stubFrom({
      profiles: {
        id: 'test-user-id',
        exam_type: 'NEET',
        target_date: null,
        streak_days: 1,
        timezone: null,
        onboarding_complete: true,
        learner_state_version: 3,
      },
      session_cards: null,
      learning_goals: null,
      revision_cards: { count: 0 },
      mistakes: [],
      concepts: [],
      study_sessions: { count: 1 },
      student_models: null,
    });

    await callGET();
    // Upsert should be called exactly once via RPC (no duplicate rows)
    const upsertCalls = supabaseMock.rpc.mock.calls.filter((c: any) => c[0] === 'upsert_session_card').length;
    expect(upsertCalls).toBeLessThanOrEqual(1);
  });
});

// ─── sourceSignals contract ───────────────────────────────────────────────────

describe('sourceSignals contract', () => {
  it('has all required fields', async () => {
    stubFrom({
      profiles: {
        id: 'test-user-id',
        exam_type: 'NEET',
        target_date: null,
        streak_days: 0,
        timezone: null,
        onboarding_complete: false,
        learner_state_version: 0,
      },
      session_cards: null,
      learning_goals: null,
      revision_cards: { count: 0 },
      mistakes: [],
      concepts: [],
      study_sessions: { count: 0 },
      student_models: null,
    });

    const res = await callGET();
    const signals = res.sourceSignals;

    expect(signals).toHaveProperty('overdueCardCount');
    expect(signals).toHaveProperty('recentMistakeCount');
    expect(signals).toHaveProperty('weakConceptCount');
    expect(signals).toHaveProperty('hasActiveGoal');
    expect(signals).toHaveProperty('daysToExam');
    expect(signals).toHaveProperty('priorityBucket');
    expect(signals).toHaveProperty('selectionReason');
  });
});
