import { logger } from '@/lib/utils/logger';

export async function logDecision(
  decision: Record<string, any>,
  userId: string,
  message: string
): Promise<void> {
  logger.info('Orchestrator decision', {
    userId,
    intent: decision.intent,
    mode: decision.mode,
    requiredWorkers: decision.requiredWorkers,
    hasMessage: message.length > 0,
  });
}
