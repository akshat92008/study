// lib/ai/degradation-messages.ts
// Context-aware degradation messages to replace the generic
// "I'm experiencing high load" string throughout the codebase.
//
// Messages are designed to:
//   1. Be helpful (explain what to do instead)
//   2. Not alarm the user
//   3. Direct them to the correct alternative action when possible

export type DegradationContext =
  | 'chat'
  | 'tutor'
  | 'mock_test'
  | 'autopsy'
  | 'pdf'
  | 'flashcards'
  | 'formula_sheet'
  | 'document_generation'
  | 'general';

const MESSAGES: Record<DegradationContext, string[]> = {
  chat: [
    "I'm temporarily unavailable — all AI services are at capacity. Please try your question again in a moment.",
    "Our AI services are catching up with demand right now. Please resend your message in a few seconds.",
  ],
  tutor: [
    "The tutoring service is temporarily at capacity. Try asking a shorter question, or come back in a moment.",
    "I'm having trouble reaching the tutoring engine right now. Please try again in a few seconds.",
  ],
  mock_test: [
    "Mock test generation is temporarily unavailable. Your request has been saved — try generating again in a moment.",
    "The AI service needed for mock test generation is temporarily busy. Please try again shortly.",
  ],
  autopsy: [
    "Mistake Review is temporarily unavailable. Your upload has been saved and will be processed when the service recovers.",
    "Mistake Review is catching up with demand. Your test file is queued and will be analyzed automatically.",
  ],
  pdf: [
    "I couldn't process that document right now. Please try again, or paste the key text directly in the chat.",
    "PDF processing is temporarily unavailable. You can paste the relevant text from your document directly here.",
  ],
  flashcards: [
    "Flashcard generation is temporarily at capacity. Please try again in a moment.",
    "I couldn't generate flashcards right now. Please try again shortly.",
  ],
  formula_sheet: [
    "Formula sheet generation is temporarily unavailable. Please try again in a moment.",
    "The formula generation service is temporarily busy. Please try again shortly.",
  ],
  document_generation: [
    "Document generation is temporarily unavailable. Please try again in a moment.",
    "I couldn't generate that document right now. Please try again shortly.",
  ],
  general: [
    "The AI service is temporarily at capacity. Please try again in a moment.",
    "I'm experiencing high demand right now. Please try again in a few seconds.",
  ],
};

let _roundRobinIndex = 0;

/**
 * Get a context-appropriate degradation message.
 * Rotates through variations to avoid repetition.
 */
export function getDegradationMessage(context: DegradationContext = 'general'): string {
  const pool = MESSAGES[context] ?? MESSAGES.general;
  const msg = pool[_roundRobinIndex % pool.length];
  _roundRobinIndex = (_roundRobinIndex + 1) % 1000;
  return msg;
}

/**
 * Convenience: get degradation message for the 'chat' context.
 * Drop-in replacement for the old literal string in router.ts.
 */
export function getChatDegradationMessage(): string {
  return getDegradationMessage('chat');
}
