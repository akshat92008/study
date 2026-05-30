import { describe, expect, it } from 'vitest';
import { normalizeSessionCardResponse } from '@/lib/dashboard/session-card-contract';

const card = {
  dayNumber: 4,
  streakDays: 3,
  focusTopic: 'Thermodynamics',
  subject: 'Physics',
  estimatedMinutes: 45,
  rationale: 'Forgetting probability is high.',
  daysToExam: 42,
  overdueCards: 2,
  masteryPercent: 37,
  isCompleted: false,
};

describe('session card response normalization', () => {
  it('reads the production { hasCard, card } response shape', () => {
    const normalized = normalizeSessionCardResponse({
      hasCard: true,
      card,
      needsOnboarding: false,
    });

    expect(normalized.status).toBe('ready');
    expect(normalized.card?.focusTopic).toBe('Thermodynamics');
    expect(normalized.card?.overdueCards).toBe(2);
  });

  it('handles onboarding and no-card states distinctly', () => {
    expect(normalizeSessionCardResponse({
      hasCard: false,
      card: null,
      needsOnboarding: true,
    }).status).toBe('onboarding');

    expect(normalizeSessionCardResponse({
      hasCard: false,
      card: null,
      needsOnboarding: false,
    }).status).toBe('empty');
  });

  it('keeps completed cards out of the active-session CTA path', () => {
    const normalized = normalizeSessionCardResponse({
      hasCard: true,
      card: { ...card, isCompleted: true },
      needsOnboarding: false,
    });

    expect(normalized.status).toBe('completed');
    expect(normalized.card?.isCompleted).toBe(true);
  });

  it('still accepts the old flat shape without breaking older callers', () => {
    const normalized = normalizeSessionCardResponse(card);

    expect(normalized.status).toBe('ready');
    expect(normalized.card?.subject).toBe('Physics');
  });
});
