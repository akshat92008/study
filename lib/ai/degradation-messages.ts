export type FailureCause =
  | 'provider_overloaded'
  | 'provider_missing_key'
  | 'provider_rate_limited'
  | 'budget_guard_failed'
  | 'db_error'
  | 'rag_unavailable'
  | 'source_processing'
  | 'source_failed'
  | 'context_too_large'
  | 'unknown'
  | 'default';

const DEGRADATION_MESSAGES: Record<FailureCause, string> = {
  provider_overloaded: 'Using offline tutor mode for this turn.',
  provider_missing_key: 'The live tutor provider is not configured, so offline tutor mode is active.',
  provider_rate_limited: 'The live tutor is rate-limited, so offline tutor mode is active for this turn.',
  budget_guard_failed: 'Live AI usage could not be authorized. Offline tutor mode is still available.',
  db_error: 'Your learning update could not be saved yet. The tutor can continue, and the save will need retrying.',
  source_processing: 'Your source is still processing. I can continue from built-in chapter memory for now.',
  source_failed: 'Your source failed to process. Reprocess it from Sources.',
  rag_unavailable: 'Source search is temporarily unavailable. I will not pretend this answer came from your material.',
  context_too_large: "Your request is a bit too complex for me to handle at once. Could you break it down?",
  unknown: 'The live tutor is unavailable for this turn. Offline tutor mode is active.',
  default: "I encountered a slight glitch. Try asking again in a moment."
};

export function getDegradationMessage(cause: FailureCause): string {
  return DEGRADATION_MESSAGES[cause] || DEGRADATION_MESSAGES['default'];
}

export function classifyFailureCause(error: unknown): FailureCause {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  const status = typeof error === 'object' && error && 'statusCode' in error ? Number((error as any).statusCode) : null;
  if (status === 429 || message.includes('rate limit')) return 'provider_rate_limited';
  if (status === 503 || message.includes('overload') || message.includes('capacity')) return 'provider_overloaded';
  if (message.includes('api key') || message.includes('missing key')) return 'provider_missing_key';
  if (message.includes('budget')) return 'budget_guard_failed';
  if (message.includes('database') || message.includes('postgres') || message.includes('supabase')) return 'db_error';
  if (message.includes('rag') || message.includes('retrieval')) return 'rag_unavailable';
  return 'unknown';
}
