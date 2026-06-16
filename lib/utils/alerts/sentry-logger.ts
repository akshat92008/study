import { logger } from '../logger';

export const alerts = {
  aiSpendBreach: (userId: string, currentSpend: number, limit: number) => {
    logger.error('[ALERT] AI Budget Exceeded', { userId, currentSpend, limit });
    // In a real implementation, this would fire an alert to Sentry or Datadog
    // e.g. Sentry.captureMessage('AI Budget Exceeded', { extra: { userId, currentSpend } })
  },
  workerFailure: (jobId: string, error: Error) => {
    logger.error('[ALERT] Background Worker Failure', { jobId, error: error.message });
    // Sentry.captureException(error, { extra: { jobId } });
  },
  dlqGrowth: (queueName: string, size: number) => {
    logger.error('[ALERT] DLQ Size Growth Warning', { queueName, size });
    // Sentry.captureMessage(`DLQ ${queueName} grew to ${size}`);
  },
  usageSystemUnavailable: (userId: string, feature: string) => {
    logger.error('[ALERT] Usage System Unavailable', { userId, feature });
    // Sentry.captureMessage('Usage System Unavailable', { extra: { userId, feature } });
  }
};
