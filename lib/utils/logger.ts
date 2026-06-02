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
    let errorStr = String(err);
    let stackStr = undefined;
    let extra = {};

    if (err instanceof Error) {
      errorStr = err.message;
      stackStr = err.stack;
    } else if (typeof err === 'object' && err !== null) {
      errorStr = err.message || JSON.stringify(err);
      if (errorStr === '{}') errorStr = String(err);
      stackStr = err.stack;
      const props: Record<string, any> = {};
      try {
        Object.getOwnPropertyNames(err).forEach(key => {
          props[key] = (err as any)[key];
        });
        extra = { error_details: props };
      } catch (e) {}
    }

    console.error(JSON.stringify({
      level: 'ERROR',
      msg,
      error: errorStr,
      stack: stackStr,
      timestamp: new Date(),
      ...(cid && { correlationId: cid }),
      ...meta,
      ...extra
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
