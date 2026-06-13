import { describe, expect, it } from 'vitest';
import { decideMindAction } from '@/lib/mind/decision-policy';
import { mayAskPracticeQuestion } from '@/lib/mind/anti-repetition';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    activeGoal: { id: 'goal-1', title: 'Circulatory System Biology' },
    todaySession: { id: 'session-1', objective: 'Recover cardiac output mistake' },
    memory: { dueCards: [], recentlyReviewedCards: [], createdToday: [] },
    autopsy: { unresolvedMistakes: [], recoverableMistakes: [], failedParses: [], recentAssessments: [] },
    sources: { relevantChunks: [], indexedSources: [], failedSources: [], pendingSources: [] },
    guardrails: { sourceGroundingAvailable: false, doNotRepeatConceptIds: [], preferredNextConceptIds: [], mustUseSessionObjective: true },
    ...overrides,
  } as any;
}

describe('MIND agent quality evals', () => {
  it('uses the session objective for what-now guidance', () => {
    expect(decideMindAction({ message: 'what now?', snapshot: snapshot() })).toBe('SESSION_GUIDANCE');
  });

  it('selects source-grounded explanation only with retrieved context', () => {
    expect(decideMindAction({
      message: 'explain vena cava',
      snapshot: snapshot({ guardrails: { sourceGroundingAvailable: true } }),
    })).toBe('SOURCE_GROUNDED_EXPLANATION');
    expect(decideMindAction({ message: 'explain vena cava', snapshot: snapshot() })).toBe('ANSWER_EXPLANATION');
  });

  it('grades a pending practice answer before answering a new topic', () => {
    expect(decideMindAction({
      message: 'B',
      pendingPracticeItem: { id: 'item-1', type: 'mcq' },
      snapshot: snapshot(),
    })).toBe('GRADE_USER_ANSWER');
  });

  it('does not repeat a correctly answered EPO concept', () => {
    expect(mayAskPracticeQuestion({
      conceptId: 'epo',
      questionText: 'Where is erythropoietin produced?',
      recent: [{ conceptId: 'epo', questionText: 'What does erythropoietin do?', outcome: 'correct' }],
    }).allowed).toBe(false);
  });

  it('requires an active goal before claiming personalization', () => {
    expect(decideMindAction({ message: 'teach me', snapshot: snapshot({ activeGoal: null }) })).toBe('ASK_CLARIFICATION');
  });
});
