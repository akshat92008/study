import { logger } from '@/lib/utils/logger';

export async function sendSlackAlert(title: string, message: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl) {
    logger.warn('Slack alert skipped; SLACK_WEBHOOK_URL is not configured', { title, message });
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `*${title}*\n${message}`,
      }),
    });

    if (!response.ok) {
      logger.warn('Slack alert failed', {
        title,
        status: response.status,
        statusText: response.statusText,
      });
    }
  } catch (error) {
    logger.warn('Slack alert request failed', { title, error });
  }
}
