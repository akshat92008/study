import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card as FSRSCard } from 'ts-fsrs';

export type ReviewRating = 'again' | 'hard' | 'good' | 'easy' | 1 | 2 | 3 | 4;

export interface ReviewSchedulerCard {
  due?: string | Date | null;
  stability?: number | null;
  difficulty?: number | null;
  elapsed_days?: number | null;
  scheduled_days?: number | null;
  reps?: number | null;
  lapses?: number | null;
  state?: number | null;
  last_review?: string | Date | null;
}

export interface ReviewScheduleResult {
  due: string;
  scheduledDays: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  reps: number;
  lapses: number;
  state: number;
  lastReview: string;
}

const DAY_MS = 86_400_000;
const scheduler = fsrs(generatorParameters({ request_retention: 0.9 }));
type FsrsReviewRating = Rating.Again | Rating.Hard | Rating.Good | Rating.Easy;

const RATING_MAP: Record<string, FsrsReviewRating> = {
  '1': Rating.Again,
  '2': Rating.Hard,
  '3': Rating.Good,
  '4': Rating.Easy,
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

function toDate(value: string | Date | null | undefined, fallback: Date): Date {
  if (value instanceof Date) return value;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return fallback;
}

function normalizeCard(card: ReviewSchedulerCard | undefined, now: Date): FSRSCard {
  if (!card) return createEmptyCard(now);

  return {
    due: toDate(card.due, now),
    stability: card.stability ?? 0,
    difficulty: card.difficulty ?? 0,
    elapsed_days: card.elapsed_days ?? 0,
    scheduled_days: card.scheduled_days ?? 0,
    reps: card.reps ?? 0,
    lapses: card.lapses ?? 0,
    state: card.state ?? State.New,
    last_review: card.last_review ? toDate(card.last_review, now) : undefined,
  };
}

function normalizeRating(rating: ReviewRating): FsrsReviewRating {
  const resolved = RATING_MAP[String(rating).toLowerCase()];
  if (!resolved) throw new Error(`Unsupported review rating: ${rating}`);
  return resolved;
}

export function firstDueAt(now = new Date()) {
  return createEmptyCard(now).due.toISOString();
}

export function scheduleNextReview(
  card: ReviewSchedulerCard | undefined,
  rating: ReviewRating,
  now = new Date()
): ReviewScheduleResult {
  const preview = scheduler.repeat(normalizeCard(card, now), now) as Record<FsrsReviewRating, { card: FSRSCard }>;
  const review = preview[normalizeRating(rating)].card;

  return {
    due: review.due.toISOString(),
    scheduledDays: review.scheduled_days,
    stability: review.stability,
    difficulty: review.difficulty,
    elapsedDays: review.elapsed_days,
    reps: review.reps,
    lapses: review.lapses,
    state: review.state,
    lastReview: (review.last_review ?? now).toISOString(),
  };
}

export function nextDueAt(days: number, now = new Date()) {
  if (days > 0) {
    return new Date(now.getTime() + days * DAY_MS).toISOString();
  }

  return scheduleNextReview(undefined, 'good', now).due;
}
