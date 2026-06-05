import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

export type ErrorSeverity = 'info' | 'warn' | 'error' | 'critical';

export async function logErrorEvent(input: {
  userId?: string | null;
  route: string;
  feature?: string | null;
  errorCode: string;
  message: string;
  severity?: ErrorSeverity;
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from('app_error_events').insert({
      user_id: input.userId ?? null,
      route: input.route,
      feature: input.feature ?? null,
      error_code: input.errorCode,
      message: input.message.slice(0, 500),
      severity: input.severity ?? 'error',
      metadata: input.metadata ?? {},
      request_id: input.requestId ?? null,
    });
    if (error) throw error;
  } catch (error: any) {
    logger.warn('[Observability] app_error_events insert failed', {
      route: input.route,
      errorCode: input.errorCode,
      error: error?.message ?? String(error),
    });
  }
}
