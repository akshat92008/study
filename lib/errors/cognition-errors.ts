export const COGNITION_ERROR_CODES = [
  'AUTH_REQUIRED',
  'ADMIN_REQUIRED',
  'ACTIVE_GOAL_MISSING',
  'GOAL_ACCESS_DENIED',
  'GOAL_NOT_FOUND',
  'CONCEPT_RESOLUTION_FAILED',
  'CONCEPT_RESOLUTION_REQUIRED',
  'CORE_LOOP_PROJECTION_FAILED',
  'CORE_LOOP_PROJECTION_REJECTED',
  'EVENT_WRITE_FAILED',
  'MASTERY_UPDATE_FAILED',
  'MEMORY_UPDATE_FAILED',
  'REVISION_UPDATE_FAILED',
  'MISTAKE_WRITE_FAILED',
  'SESSION_UPDATE_FAILED',
  'EVENT_PUBLISH_FAILED',
  'SOURCE_NOT_INDEXED',
  'SOURCE_EXTRACTION_FAILED',
  'PRACTICE_ITEM_NOT_FOUND',
  'PRACTICE_ALREADY_SUBMITTED',
  'PRACTICE_PROJECTION_FAILED',
  'LEARNING_EVENT_FAILED',
  'AUTOPSY_PARSE_FAILED',
  'AUTOPSY_DIAGNOSIS_FAILED',
  'AUTOPSY_PROJECTION_FAILED',
  'SESSION_CARD_NOT_FOUND',
  'SESSION_COMPLETION_FAILED',
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'DATABASE_CONSTRAINT_FAILED',
  'UNKNOWN_INTERNAL_ERROR',
] as const;

export type CognitionErrorCode = (typeof COGNITION_ERROR_CODES)[number];

export class CognitionError extends Error {
  constructor(
    public readonly code: CognitionErrorCode,
    message: string,
    public readonly retryable = false,
    public readonly traceId?: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'CognitionError';
  }
}

export function toCognitionError(
  error: unknown,
  fallbackCode: CognitionErrorCode = 'UNKNOWN_INTERNAL_ERROR',
  fallbackMessage = 'Cognition OS could not complete this action.',
  traceId?: string
): CognitionError {
  if (error instanceof CognitionError) return error;
  return new CognitionError(
    fallbackCode,
    error instanceof Error && error.message ? error.message : fallbackMessage,
    false,
    traceId,
    error
  );
}

export function cognitionErrorPayload(error: CognitionError) {
  return {
    ok: false as const,
    code: error.code,
    message: error.message,
    retryable: error.retryable,
    traceId: error.traceId,
  };
}
