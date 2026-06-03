// lib/hermes/hermes-logger.ts
// Thin wrapper around the existing logger.
// Adds [Hermes] prefix and respects HERMES_LOG_OUTPUT.
// Never logs raw user data in production.

import { logger } from '@/lib/utils/logger';
import { readBool } from './hermes-internal-utils';

export const hermesLogger = {
  info(message: string, meta?: Record<string, unknown>): void {
    logger.info(`[Hermes] ${message}`, { ...meta, feature: 'hermes' });
  },

  warn(message: string, meta?: Record<string, unknown>): void {
    logger.warn(`[Hermes] ${message}`, { ...meta, feature: 'hermes' });
  },

  error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    logger.error(`[Hermes] ${message}`, error instanceof Error ? error : new Error(String(error)), {
      ...meta,
      feature: 'hermes',
    });
  },

  // Only logs raw output when HERMES_LOG_OUTPUT=true (never in production)
  debug(message: string, meta?: Record<string, unknown>): void {
    if (readBool('HERMES_LOG_OUTPUT', false)) {
      logger.info(`[Hermes:debug] ${message}`, { ...meta, feature: 'hermes' });
    }
  },
};
