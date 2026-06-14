import { normalizeNeetGoal, GoalMode, NormalizedGoal } from '../syllabus/neet-ug-2026';

export type { GoalMode, NormalizedGoal };

export function normalizeGoal(rawTitle: string, activeSubjectContext?: string | null): NormalizedGoal {
  return normalizeNeetGoal(rawTitle, activeSubjectContext);
}
