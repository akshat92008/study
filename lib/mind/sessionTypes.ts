// lib/mind/sessionTypes.ts
/** Types used by the MIND finite‑state‑machine */
export type MindMode = 'idle' | 'direct' | 'learning' | 'session' | 'artifact';

export interface MindState {
  mode: MindMode;
  focusTopic?: string; // concept id or name
  step?: number; // current step index within a session
  // Arbitrary JSON state that can be persisted
  data?: Record<string, any>;
}

export interface DetectedGap {
  conceptId: string;
  description: string;
}

export interface MasteryEvidence {
  type: 'correct_answer' | 'wrong_answer' | 'session_completed' | 'card_review';
  strength: number;
  sourceId: string;
  rating?: 'again' | 'hard' | 'good' | 'easy'; // for card_review
}

export interface CardSeed {
  conceptId: string;
  title: string;
  // other fields that can seed future memory cards
}

export interface TutorResponse {
  tutorReply: string;
  detectedGap?: DetectedGap;
  masteryEvidence?: MasteryEvidence;
  cardSeeds?: CardSeed[];
  nextState?: MindState;
}
