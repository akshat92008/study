import { z } from 'zod';

// Structured logging for production observability
export const logger = {
  correlationIdProvider: (): string | undefined => undefined,
  info: (msg: string, meta?: any) => {
    const cid = logger.correlationIdProvider();
    console.log(JSON.stringify({ level: 'INFO', msg, timestamp: new Date(), ...(cid && { correlationId: cid }), ...meta }));
  },
  warn: (msg: string, meta?: any) => {
    const cid = logger.correlationIdProvider();
    console.warn(JSON.stringify({ level: 'WARN', msg, timestamp: new Date(), ...(cid && { correlationId: cid }), ...meta }));
  },
  error: (msg: string, err?: any, meta?: any) => {
    const cid = logger.correlationIdProvider();
    console.error(JSON.stringify({
      level: 'ERROR',
      msg,
      error: err instanceof Error ? err.message : typeof err === 'object' && err !== null ? JSON.stringify(err) : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date(),
      ...(cid && { correlationId: cid }),
      ...meta
    }));
  }
};

// Standardized safe API error response
export function safeError(err: unknown) {
  if (err instanceof z.ZodError) {
    return { error: 'Validation failed', details: err.errors };
  }
  
  // Log the actual error internally
  logger.error('Unhandled Server Error', err);
  
  // Return generic error to client
  return { error: 'An unexpected error occurred. Please try again later.' };
}
