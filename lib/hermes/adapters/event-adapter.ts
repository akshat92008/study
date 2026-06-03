// lib/hermes/adapters/event-adapter.ts
// Converts Hermes-related inputs into event payloads for the event queue.
// Used when an API route wants to trigger async Hermes processing.

export type HermesMistakeEventPayload = {
  mistakeId: string;
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
  question: string;
  myAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
};

export type HermesSourceEventPayload = {
  materialId: string;
  userId: string;
  goalId?: string | null;
  title: string;
};

export type HermesTraceEventPayload = {
  userId: string;
  goalId: string;
  reason?: string;
};

/**
 * Build event payload for HERMES_MISTAKE_REVIEW_REQUESTED.
 * Used when the mistake route wants async Hermes processing via event queue.
 */
export function buildMistakeEventPayload(
  params: HermesMistakeEventPayload
): Record<string, unknown> {
  return {
    mistakeId: params.mistakeId,
    userId: params.userId,
    goalId: params.goalId ?? null,
    chatSessionId: params.chatSessionId ?? null,
    question: params.question.slice(0, 500),
    myAnswer: params.myAnswer.slice(0, 200),
    correctAnswer: params.correctAnswer.slice(0, 200),
    explanation: params.explanation?.slice(0, 400) ?? null,
  };
}

/**
 * Build event payload for HERMES_SOURCE_PROCESS_REQUESTED.
 */
export function buildSourceEventPayload(
  params: HermesSourceEventPayload
): Record<string, unknown> {
  return {
    materialId: params.materialId,
    userId: params.userId,
    goalId: params.goalId ?? null,
    title: params.title.slice(0, 200),
  };
}

/**
 * Build event payload for HERMES_TRACE_REQUESTED.
 */
export function buildTraceEventPayload(
  params: HermesTraceEventPayload
): Record<string, unknown> {
  return {
    userId: params.userId,
    goalId: params.goalId,
    reason: params.reason ?? 'scheduled',
  };
}
