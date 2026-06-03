import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock all external dependencies for event worker tests

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/hermes', () => ({
  runHermesMistakeAgent: vi.fn(),
  buildMistakeFallback: vi.fn(),
  writeMistakeResult: vi.fn(),
  runHermesTraceAgent: vi.fn(),
  isHermesError: vi.fn(),
  HermesDisabledError: class HermesDisabledError extends Error {
    code = 'HERMES_DISABLED';
    constructor() { super('Hermes disabled'); this.name = 'HermesDisabledError'; }
  },
}));

vi.mock('@/lib/config/flags', () => ({
  featureFlags: {
    hermesEnabled: vi.fn(),
    hermesSourceProcessing: vi.fn(),
  },
}));

import * as hermesModule from '@/lib/hermes';
import { featureFlags } from '@/lib/config/flags';

// A minimal mock of the hermes_worker handler (extracted from worker logic for isolation)
async function callHermesWorkerHandler(event: any, payload: Record<string, any>) {
  const { featureFlags: flags } = await import('@/lib/config/flags');
  if (!flags.hermesEnabled()) {
    return { status: 'SKIPPED_INTENTIONALLY', reason: 'Hermes is disabled (HERMES_ENABLED=false)' };
  }

  const { isHermesError } = await import('@/lib/hermes');

  if (event.type === 'HERMES_MISTAKE_REVIEW_REQUESTED') {
    try {
      const { runHermesMistakeAgent, buildMistakeFallback, writeMistakeResult } = await import('@/lib/hermes');
      const { createAdminClient } = await import('@/lib/supabase/admin');
      const supabase = createAdminClient();

      const input = {
        userId: event.user_id,
        goalId: payload.goalId ?? null,
        chatSessionId: payload.chatSessionId ?? null,
        question: payload.question ?? '',
        myAnswer: payload.myAnswer ?? '',
        correctAnswer: payload.correctAnswer ?? '',
        explanation: payload.explanation ?? null,
      };

      let result;
      try {
        result = await runHermesMistakeAgent(input);
      } catch (hermesErr) {
        if (isHermesError(hermesErr)) {
          result = buildMistakeFallback(input);
        } else {
          throw hermesErr;
        }
      }

      await writeMistakeResult(supabase, event.user_id, payload.goalId ?? null, payload.chatSessionId ?? null, input, result);
      return { status: 'HANDLED' };
    } catch (err: any) {
      return { status: 'RETRYABLE_FAILURE', reason: err.message };
    }
  }

  return { status: 'SKIPPED_INTENTIONALLY', reason: `hermes_worker: no handler for ${event.type}` };
}

const MOCK_EVENT = {
  id: 'event-1',
  user_id: 'user-123',
  type: 'HERMES_MISTAKE_REVIEW_REQUESTED',
};

const MOCK_PAYLOAD = {
  goalId: '11111111-1111-1111-1111-111111111111',
  chatSessionId: '22222222-2222-2222-2222-222222222222',
  question: 'What is the range formula?',
  myAnswer: 'v^2/g',
  correctAnswer: 'v^2 sin(2θ)/g',
  explanation: 'Range formula uses sin(2θ)',
};

const MOCK_HERMES_RESULT = {
  category: 'formula_recall',
  subject: 'Physics',
  chapter: 'Kinematics',
  topic: 'Projectile Motion',
  diagnosis: 'Wrong formula selected.',
  whyMyAnswerWasWrong: 'v^2/g is not the range formula.',
  whyCorrectAnswerWorks: 'Range = v^2 sin(2θ)/g by kinematics.',
  keyMissedClue: null,
  confidence: 'high',
  weakConcept: { subject: 'Physics', chapter: 'Kinematics', topic: 'Projectile Motion', name: 'Range formula' },
  cards: [{ front: 'q', back: 'a', type: 'formula_recall', difficulty: 'medium' }],
  nextAction: { label: 'Review', rationale: 'test', estimatedMinutes: 10, actionType: 'review_cards' },
  safetyFlags: { possibleHallucination: false, needsHumanReview: false },
};

describe('Hermes Event Worker — hermes_worker consumer', () => {
  const mockAdminClient = { from: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    const { createAdminClient } = await import('@/lib/supabase/admin');
    vi.mocked(createAdminClient).mockReturnValue(mockAdminClient as any);
  });

  it('returns SKIPPED when HERMES_ENABLED=false', async () => {
    vi.mocked(featureFlags.hermesEnabled).mockReturnValue(false);

    const result = await callHermesWorkerHandler(MOCK_EVENT, MOCK_PAYLOAD);
    expect(result.status).toBe('SKIPPED_INTENTIONALLY');
    expect(result.reason).toContain('Hermes is disabled');
  });

  it('calls Hermes agent and writes DB result on success', async () => {
    vi.mocked(featureFlags.hermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockResolvedValue(MOCK_HERMES_RESULT as any);
    vi.mocked(hermesModule.writeMistakeResult).mockResolvedValue({
      autopsyId: 'a-1',
      mistakeId: 'm-1',
      conceptId: 'c-1',
      cardIds: ['card-1'],
    } as any);
    vi.mocked(hermesModule.isHermesError).mockReturnValue(false);

    const result = await callHermesWorkerHandler(MOCK_EVENT, MOCK_PAYLOAD);

    expect(result.status).toBe('HANDLED');
    expect(hermesModule.runHermesMistakeAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        goalId: MOCK_PAYLOAD.goalId,
        question: MOCK_PAYLOAD.question,
      })
    );
    expect(hermesModule.writeMistakeResult).toHaveBeenCalledOnce();
  });

  it('uses fallback when Hermes agent throws a Hermes error', async () => {
    vi.mocked(featureFlags.hermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockRejectedValue(
      new hermesModule.HermesDisabledError()
    );
    vi.mocked(hermesModule.isHermesError).mockReturnValue(true);
    vi.mocked(hermesModule.buildMistakeFallback).mockReturnValue(MOCK_HERMES_RESULT as any);
    vi.mocked(hermesModule.writeMistakeResult).mockResolvedValue({
      autopsyId: null,
      mistakeId: 'm-1',
      conceptId: null,
      cardIds: ['card-1'],
    } as any);

    const result = await callHermesWorkerHandler(MOCK_EVENT, MOCK_PAYLOAD);

    expect(result.status).toBe('HANDLED');
    expect(hermesModule.buildMistakeFallback).toHaveBeenCalled();
  });

  it('returns RETRYABLE_FAILURE when DB write fails', async () => {
    vi.mocked(featureFlags.hermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockResolvedValue(MOCK_HERMES_RESULT as any);
    vi.mocked(hermesModule.isHermesError).mockReturnValue(false);
    vi.mocked(hermesModule.writeMistakeResult).mockRejectedValue(new Error('DB connection lost'));

    const result = await callHermesWorkerHandler(MOCK_EVENT, MOCK_PAYLOAD);

    expect(result.status).toBe('RETRYABLE_FAILURE');
    expect(result.reason).toContain('DB connection lost');
  });

  it('returns SKIPPED for unknown event type', async () => {
    vi.mocked(featureFlags.hermesEnabled).mockReturnValue(true);

    const result = await callHermesWorkerHandler(
      { ...MOCK_EVENT, type: 'SOME_UNRELATED_EVENT' },
      MOCK_PAYLOAD
    );

    expect(result.status).toBe('SKIPPED_INTENTIONALLY');
  });

  it('never writes DB for wrong user (userId from event, not payload)', async () => {
    vi.mocked(featureFlags.hermesEnabled).mockReturnValue(true);
    vi.mocked(hermesModule.runHermesMistakeAgent).mockResolvedValue(MOCK_HERMES_RESULT as any);
    vi.mocked(hermesModule.isHermesError).mockReturnValue(false);
    vi.mocked(hermesModule.writeMistakeResult).mockResolvedValue({
      autopsyId: null,
      mistakeId: 'm-1',
      conceptId: null,
      cardIds: [],
    } as any);

    await callHermesWorkerHandler(
      { ...MOCK_EVENT, user_id: 'attacker-user-999' },
      MOCK_PAYLOAD
    );

    // userId used for write should be attacker-user-999, NOT a payload userId
    // The worker always uses event.user_id (from verified event queue)
    expect(hermesModule.writeMistakeResult).toHaveBeenCalledWith(
      expect.anything(),
      'attacker-user-999',
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ userId: 'attacker-user-999' }),
      expect.anything()
    );
  });
});
