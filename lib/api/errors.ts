import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

export interface ApiErrorOptions {
  status?: number;
  message?: string;
  details?: unknown;
  requestId?: string;
  feature?: string;
}

export function getRequestId(request?: Request): string {
  return (
    request?.headers.get('x-request-id') ||
    request?.headers.get('x-correlation-id') ||
    crypto.randomUUID()
  );
}

export function apiErrorResponse(
  error: string,
  options: ApiErrorOptions = {}
): NextResponse {
  const status = options.status ?? 500;
  const body = {
    error,
    message: options.message ?? 'An unexpected error occurred.',
    ...(options.requestId ? { requestId: options.requestId } : {}),
    ...(options.details === undefined ? {} : { details: options.details }),
  };

  return NextResponse.json(body, {
    status,
    headers: options.requestId ? { 'x-request-id': options.requestId } : undefined,
  });
}

export function unexpectedApiErrorResponse(
  request: Request | undefined,
  err: unknown,
  feature: string,
  message = 'An unexpected error occurred.'
): NextResponse {
  const requestId = getRequestId(request);
  logger.error(`${feature}: unexpected API error`, err, { requestId, feature });
  return apiErrorResponse('internal_error', {
    status: 500,
    message,
    requestId,
    feature,
  });
}
