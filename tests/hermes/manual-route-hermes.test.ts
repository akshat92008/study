import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/autopsy/manual/route';
import { createMockRequest } from '@/tests/utils/next-request-mock';
import { createMockSupabaseClient } from '@/tests/utils/supabase-mock';
import * as serverSupabase from '@/lib/supabase/server';
import * as hermesModule from '@/lib/hermes';

// Mock supabase
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

// Mock goal-context service
vi.mock('@/lib/services/goal-context.service', () => ({
  ensureGoalForUser: vi.fn().mockResolvedValue({ id: 'goal-1', user_id: 'user-123', title: 'NEET Physics' }),
  ensureSessionBelongsToUser: vi.fn().mockResolvedValue({ id: 'session-1', goal_id: 'goal-1', is_global: false }),
  ensureSessionGoalLink: vi.fn().mockResolvedValue(undefined),
  getActiveGoalContext: vi.fn().mockResolvedValue({ goal: { id: 'goal-1', title: 'NEET Physics' } }),
}));

// Mock Hermes module
vi.mock('@/lib/hermes', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hermes')>();
  return {
    ...actual,
    isHermesEnabled: vi.fn(),
    runHermesMistakeAgent: vi.fn(),
    buildMistakeFallback: vi.fn(),
    writeMistakeResult: vi.fn(),
    isHermesError: vi.fn(),
  };
});

// Mock budgetedGenerateJSON for deterministic fallback path
vi.mock('@/lib/ai/budgeted', () => ({
  budgetedGenerateJSON: vi.fn(),
}));

import { budgetedGenerateJSON } from '@/lib/ai/budgeted';

const VALID_BODY = {
  question: 'A projectile is thrown at 45 degrees. What is the range?',
  myAnswer: 'v^2/2g',
  correctAnswer: 'v^2 sin(2θ)/g',
  explanation: 'Range formula uses sin(2θ).',
  goalId: '11111111-1111-1111-1111-111111111111',
  chatSessionId: '22222222-2222-2222-2222-222222222222',
};

const VALID_HERMES_RESULT = {
  category: 'formula_recall',
  subject: 'Physics',
  chapter: 'Kinematics',
  topic: 'Projectile Motion',
  diagnosis: 'Student used incorrect range formula.',
  whyMyAnswerWasWrong: 'v^2/2g is maximum height formula, not range.',
  whyCorrectAnswerWorks: 'Range is v^2 sin(2θ)/g, derived from kinematics equations.',
  keyMissedClue: 'The question asked for range, not maximum height.',
  confidence: 'high',
  weakConcept: {
    subject: 'Physics',
    chapter: 'Kinematics',
    topic: 'Projectile Motion',
    name: 'Range formula for projectile',
  },
  cards: [
    { front: 'Range formula?', back: 'v^2 sin(2θ)/g', type: 'formula_recall', difficulty: 'medium' },
    { front: 'Max height formula?', back: 'v^2 sin²(θ)/2g', type: 'error_pattern', difficulty: 'medium' },
    { front: 'At 45 degrees, sin(2θ)=?', back: '1 (maximum)', type: 'similar_trap', difficulty: 'easy' },
  ],
  nextAction: {
    label: 'Review projectile motion formulas',
    rationale: 'Multiple formulas must be memorized carefully.',
    estimatedMinutes: 15,
    actionType: 'review_cards',
  },
  safetyFlags: { possibleHallucination: false, needsHumanReview: false },
};

const VALID_DB_RESULT = {
  autopsyId: 'autopsy-1',
  mistakeId: 'mistake-1',
  conceptId: 'concept-1',
  cardIds: ['card-1', 'card-2', 'card-3'],
};

describe('Manual Autopsy Route — with Hermes', () => {
  const { client, chain } = createMockSupabaseClient();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(serverSupabase.createClient).mockResolvedValue(client as any);
    client.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-123' } }, error: null });

    // Mock weak concepts query
    chain.order.mockReturnThis();
    chain.limit.mockResolvedValue({ data: [], error: null });

    vi.mocked(hermesModule.writeMistakeResult).mockResolvedValue(VALID_DB_RESULT as any);
  });

  it('returns 401 when not authenticated', async () => {
    client.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('Not authenticated') });

    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', VALID_BODY);
    const response = await POST(req);

    expect(response.status).toBe(401);
  });

  it('returns 400 when required fields are missing', async () => {
    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', {
      question: 'What is this?',
      // missing myAnswer and correctAnswer
    });
    const response = await POST(req);
    expect(response.status).toBe(400);
  });

  it('calls Hermes agent when HERMES_ENABLED=true', async () => {
    vi.mocked(hermesModule.isHermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockResolvedValue(VALID_HERMES_RESULT as any);

    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', VALID_BODY);
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(hermesModule.runHermesMistakeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        goalId: VALID_BODY.goalId,
        chatSessionId: VALID_BODY.chatSessionId,
        question: VALID_BODY.question,
        myAnswer: VALID_BODY.myAnswer,
        correctAnswer: VALID_BODY.correctAnswer,
      })
    );

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.mistakeId).toBe('mistake-1');
    expect(data.diagnosis).toBe(VALID_HERMES_RESULT.diagnosis);
    expect(data.whyMyAnswerWasWrong).toBe(VALID_HERMES_RESULT.whyMyAnswerWasWrong);
    expect(data.whyCorrectAnswerWorks).toBe(VALID_HERMES_RESULT.whyCorrectAnswerWorks);
    expect(data.cardsCreated).toBe(3);
    expect(data.nextAction).toBeDefined();
    expect(data.confidence).toBe('high');
    expect(data._meta.usedHermes).toBe(true);
  });

  it('creates goal-scoped mistake via writeMistakeResult', async () => {
    vi.mocked(hermesModule.isHermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockResolvedValue(VALID_HERMES_RESULT as any);

    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', VALID_BODY);
    await POST(req);

    expect(hermesModule.writeMistakeResult).toHaveBeenCalledWith(
      expect.anything(),
      'user-123',
      VALID_BODY.goalId,
      VALID_BODY.chatSessionId,
      expect.objectContaining({ goalId: VALID_BODY.goalId }),
      expect.objectContaining({ category: 'formula_recall' })
    );
  });

  it('uses deterministic fallback when Hermes disabled', async () => {
    vi.mocked(hermesModule.isHermesEnabled).mockReturnValue(false);
    vi.mocked(budgetedGenerateJSON as any)
      .mockResolvedValueOnce({ category: 'formula_recall', subject: 'Physics', chapter: 'Kinematics', topic: 'Range', diagnosis: 'Wrong formula' })
      .mockResolvedValueOnce({ cards: [{ front: 'q', back: 'a', type: 'mistake_concept' }], nextAction: 'Review cards' });

    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', VALID_BODY);
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(hermesModule.runHermesMistakeAgent).not.toHaveBeenCalled();
    const data = await response.json();
    expect(data._meta.usedHermes).toBe(false);
  });

  it('falls back to deterministic when Hermes throws HermesDisabledError', async () => {
    vi.mocked(hermesModule.isHermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.isHermesError).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockRejectedValue(
      new hermesModule.HermesDisabledError()
    );
    vi.mocked(hermesModule.buildMistakeFallback).mockReturnValue(VALID_HERMES_RESULT as any);

    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', VALID_BODY);
    const response = await POST(req);

    expect(response.status).toBe(200);
    expect(hermesModule.buildMistakeFallback).toHaveBeenCalled();
  });

  it('never exposes raw error message to user', async () => {
    vi.mocked(hermesModule.isHermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockRejectedValue(new Error('Internal provider crashed'));
    vi.mocked(hermesModule.isHermesError).mockReturnValue(false);
    vi.mocked(hermesModule.buildMistakeFallback).mockReturnValue(VALID_HERMES_RESULT as any);
    // Also make writeMistakeResult fail to trigger the 500 path
    vi.mocked(hermesModule.writeMistakeResult).mockRejectedValue(new Error('DB is down'));

    const req = createMockRequest('POST', 'http://localhost/api/autopsy/manual', VALID_BODY);
    const response = await POST(req);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).not.toContain('provider crashed');
    expect(data.error).not.toContain('DB is down');
    expect(typeof data.error).toBe('string');
  });
});
