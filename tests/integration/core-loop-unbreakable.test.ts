import { describe, expect, it, vi, beforeEach } from 'vitest';
import { applyLearningEvent } from '@/lib/learner-state/apply-learning-event';

const mockRpc = vi.fn();
const mockInsert = vi.fn();

const mockSupabase = {
  rpc: mockRpc,
  from: vi.fn((table: string) => {
    const chainHandler: ProxyHandler<any> = {
      get(target, prop) {
        if (prop === 'single' || prop === 'maybeSingle') {
          return vi.fn(async () => {
            if (table === 'profiles') return { data: { timezone: 'UTC' }, error: null };
            if (table === 'concepts') return { data: { id: 'concept-1', mastery: 0.5, mastery_score: 0.5 }, error: null };
            if (table === 'concept_masteries') return { data: { mastery: 0.5, stability: 0.5 }, error: null };
            return { data: null, error: null };
          });
        }
        if (prop === 'then') {
          return function(resolve: any) {
            resolve({ data: [], error: null });
          };
        }
        if (typeof prop === 'string') {
          return vi.fn(() => new Proxy({}, chainHandler));
        }
        return undefined;
      }
    };
    return new Proxy({}, chainHandler);
  }),
} as any;

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => mockSupabase),
}));

vi.mock('@/lib/goals/resolve-active-goal', () => ({
  resolveActiveGoalForUser: vi.fn(async () => ({ goalId: 'goal-1', source: 'active' })),
}));

describe('Unbreakable Core Loop Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('projects learner state atomically via RPC', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: true,
        learning_event_id: 'learning-event:user-1:chat_practice:mock',
        concept_id: 'concept-1',
        mastery_before: 0.5,
        mastery_after: 0.6,
        revision_card_ids: ['card-1'],
        mistake_ids: [],
        invalidation_triggered: true,
      },
      error: null,
    });

    const result = await applyLearningEvent(mockSupabase, {
      userId: 'user-1',
      goalId: 'goal-1',
      source: 'chat_practice',
      concept: { canonicalName: 'Newton Laws', topic: 'Physics' },
      result: { outcome: 'correct' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.learningEventId).toContain('learning-event:user-1:chat_practice');
      expect(result.conceptId).toBe('concept-1');
      expect(result.masteryBefore).toBe(0.5);
      expect(result.masteryAfter).toBeGreaterThan(0.5);
      expect(result.revisionCardIds).toEqual(['card-1']);
      expect(result.sessionCardInvalidated).toBe(false);
    }

    expect(mockRpc).toHaveBeenCalledWith('apply_core_loop_projection', {
      payload: expect.objectContaining({
        user_id: 'user-1',
        learner_event: expect.objectContaining({
          type: 'concept_understood',
          data: expect.objectContaining({
            concept: 'Newton Laws',
          })
        }),
      })
    });
  });

  it('surfaces RPC errors as CognitionError', async () => {
    mockRpc.mockResolvedValueOnce({
      data: {
        ok: false,
        message: 'Failed to update mastery',
        errors: [{ code: 'CORE_LOOP_PROJECTION_FAILED', message: 'Failed to update mastery' }],
      },
      error: null,
    });

    const result = await applyLearningEvent(mockSupabase, {
      userId: 'user-1',
      goalId: 'goal-1',
      source: 'autopsy',
      concept: { canonicalName: 'Calculus', topic: 'Math' },
      result: { outcome: 'incorrect' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('EVENT_WRITE_FAILED'); // normalized in applyLearningEvent
      expect(result.message).toContain('Failed to update mastery');
    }
  });

  it('requires a user ID', async () => {
    const result = await applyLearningEvent(mockSupabase, {
      userId: '',
      goalId: 'goal-1',
      source: 'chat_practice',
      concept: { canonicalName: 'Newton Laws', topic: 'Physics' },
      result: { outcome: 'correct' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('AUTH_REQUIRED');
      expect(result.message).toBe('Authentication is required.');
    }
  });
});
