// lib/models/learnerState.ts

export interface LearnerState {
  userId: string;
  conceptId: string;
  masteryScore: number; // 0.0 – 1.0
  lastUpdated: Date;
}
