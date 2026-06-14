export type FailureCause = 'provider_overloaded' | 'source_processing' | 'rag_unavailable' | 'context_too_large' | 'default';

const DEGRADATION_MESSAGES: Record<FailureCause, string> = {
  provider_overloaded: "I'm sorry, my AI services are currently at capacity. I've fallen back to offline mode for now.",
  source_processing: "Your uploaded material is still being processed. I won't be able to answer specific questions from it until it finishes.",
  rag_unavailable: "I'm having trouble searching your materials right now. I'll do my best with my general knowledge.",
  context_too_large: "Your request is a bit too complex for me to handle at once. Could you break it down?",
  default: "I encountered a slight glitch. Try asking again in a moment."
};

export function getDegradationMessage(cause: FailureCause): string {
  return DEGRADATION_MESSAGES[cause] || DEGRADATION_MESSAGES['default'];
}
