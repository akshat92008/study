import { z } from 'zod';

// Structured logging for production observability
export const logger = {
  info: (msg: string, meta?: any) => console.log(JSON.stringify({ level: 'INFO', msg, timestamp: new Date(), ...meta })),
  warn: (msg: string, meta?: any) => console.warn(JSON.stringify({ level: 'WARN', msg, timestamp: new Date(), ...meta })),
  error: (msg: string, err?: any, meta?: any) => {
    console.error(JSON.stringify({
      level: 'ERROR',
      msg,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
      timestamp: new Date(),
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
