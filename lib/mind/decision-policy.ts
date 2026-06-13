import type { MindStateSnapshot } from '@/lib/mind/get-mind-state-snapshot';

export type MindDecision =
  | 'ANSWER_EXPLANATION'
  | 'SOURCE_GROUNDED_EXPLANATION'
  | 'SESSION_GUIDANCE'
  | 'CREATE_PRACTICE'
  | 'GRADE_USER_ANSWER'
  | 'REVIEW_MEMORY_CARD'
  | 'REVIEW_AUTOPSY_MISTAKE'
  | 'UPDATE_LEARNER_STATE'
  | 'ASK_CLARIFICATION'
  | 'BLOCK_UNSUPPORTED_ACTION'
  | 'SMALL_TALK_REDIRECT_TO_GOAL';

export function decideMindAction(input: {
  message: string;
  snapshot: MindStateSnapshot;
  pendingPracticeItem?: { id: string; type: string } | null;
}): MindDecision {
  const message = input.message.trim().toLowerCase();
  if (!input.snapshot.activeGoal) return 'ASK_CLARIFICATION';
  if (input.pendingPracticeItem && /^(?:[a-d]|option\s+[a-d]|\d+(?:\.\d+)?|.{1,120})$/i.test(message)) {
    return 'GRADE_USER_ANSWER';
  }
  if (/\b(quiz|practice|mcq|test me|questions?)\b/.test(message)) return 'CREATE_PRACTICE';
  if (/\b(what should i do|what now|today'?s task|continue session)\b/.test(message)) return 'SESSION_GUIDANCE';
  if (/\b(review|revise|flashcard|memory card)\b/.test(message) && input.snapshot.memory.dueCards.length > 0) return 'REVIEW_MEMORY_CARD';
  if (/\b(mistake|wrong answer|autopsy|why was i wrong)\b/.test(message) && input.snapshot.autopsy.unresolvedMistakes.length > 0) return 'REVIEW_AUTOPSY_MISTAKE';
  if (input.snapshot.guardrails.sourceGroundingAvailable) return 'SOURCE_GROUNDED_EXPLANATION';
  if (/^(hi|hello|hey|thanks|thank you)$/.test(message)) return 'SMALL_TALK_REDIRECT_TO_GOAL';
  return 'ANSWER_EXPLANATION';
}
