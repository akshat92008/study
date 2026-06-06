export interface ClientSessionCard {
  dayNumber: number;
  streakDays: number;
  focusTopic: string;
  subject: string;
  estimatedMinutes: number;
  rationale: string;
  daysToExam: number | null;
  overdueCards: number;
  masteryPercent: number;
  taskType?: string;
  resourceType?: string;
  targetConceptId?: string | null;
  targetMistakeId?: string | null;
  targetRetestId?: string | null;
  repairPhase?: 'immediate_repair' | 'delayed_retest' | null;
  priority?: string;
  isCompleted?: boolean;
  completedAt?: string | null;
  taskId?: string | null;
}

export type SessionCardUiStatus =
  | 'ready'
  | 'completed'
  | 'onboarding'
  | 'empty'
  | 'error';

export interface NormalizedSessionCardState {
  status: SessionCardUiStatus;
  card: ClientSessionCard | null;
  errorMessage?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringOr(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toClientCard(value: unknown): ClientSessionCard | null {
  if (!isRecord(value)) return null;
  const focusTopic = stringOr(value.focusTopic, '');
  const subject = stringOr(value.subject, 'General');
  if (!focusTopic) return null;

  return {
    dayNumber: numberOr(value.dayNumber, 1),
    streakDays: numberOr(value.streakDays, 0),
    focusTopic,
    subject,
    estimatedMinutes: Math.max(1, numberOr(value.estimatedMinutes, 45)),
    rationale: stringOr(value.rationale, ''),
    daysToExam:
      typeof value.daysToExam === 'number' && Number.isFinite(value.daysToExam)
        ? value.daysToExam
        : null,
    overdueCards: numberOr(value.overdueCards, 0),
    masteryPercent: numberOr(value.masteryPercent, 0),
    taskType: stringOr(value.taskType, ''),
    resourceType: stringOr(value.resourceType, ''),
    targetConceptId: nullableString(value.targetConceptId),
    targetMistakeId: nullableString(value.targetMistakeId),
    targetRetestId: nullableString(value.targetRetestId),
    repairPhase:
      value.repairPhase === 'immediate_repair' || value.repairPhase === 'delayed_retest'
        ? value.repairPhase
        : null,
    priority: stringOr(value.priority, ''),
    isCompleted: value.isCompleted === true,
    completedAt: nullableString(value.completedAt),
    taskId: nullableString(value.taskId),
  };
}

export function normalizeSessionCardResponse(raw: unknown): NormalizedSessionCardState {
  if (!isRecord(raw)) {
    return { status: 'error', card: null, errorMessage: 'Unable to load today\'s session.' };
  }

  if (typeof raw.error === 'string') {
    return { status: 'error', card: null, errorMessage: raw.error };
  }

  if ('hasCard' in raw || 'card' in raw || 'needsOnboarding' in raw) {
    if (raw.needsOnboarding === true) {
      return { status: 'onboarding', card: null };
    }

    if (raw.hasCard === false || raw.card === null) {
      return { status: 'empty', card: null };
    }

    const card = toClientCard(raw.card);
    if (!card) {
      return { status: 'empty', card: null };
    }

    return { status: card.isCompleted ? 'completed' : 'ready', card };
  }

  const legacyCard = toClientCard(raw);
  if (legacyCard) {
    return { status: legacyCard.isCompleted ? 'completed' : 'ready', card: legacyCard };
  }

  return { status: 'empty', card: null };
}
