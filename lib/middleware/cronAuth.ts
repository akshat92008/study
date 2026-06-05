// lib/middleware/cronAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';

/**
 * Validate that a cron request is authentic.
 * Vercel Cron sets the Authorization header with INTERNAL_CRON_SECRET.
 */
export function validateCronRequest(req: NextRequest): NextResponse | null {
  const cronSecret = process.env.INTERNAL_CRON_SECRET || process.env.CRON_SECRET;
  const workerSecret = process.env.INTERNAL_WORKER_SECRET;
  const nodeEnv = process.env['NODE_ENV'];
  const requestId = getRequestId(req);
  
  const weakSecrets = new Set([
    'super_secret_cron_token_123',
    'super_secret_worker_token_123',
    'test-secret',
    'changeme',
    'change-me',
    'secret',
    'cron_secret',
    'worker_secret',
  ]);

  const providedWorkerSecret = req.headers.get('x-internal-worker-secret');
  const providedAuthHeader = req.headers.get('authorization');

  // If worker secret header is provided, validate against INTERNAL_WORKER_SECRET
  if (providedWorkerSecret !== null) {
    if (
      !workerSecret ||
      (nodeEnv !== 'test' && (workerSecret.length < 32 || weakSecrets.has(workerSecret)))
    ) {
      console.error('[WorkerAuth] INTERNAL_WORKER_SECRET not configured safely!');
      return apiErrorResponse('worker_not_configured', {
        status: 500,
        message: 'INTERNAL_WORKER_SECRET is not configured safely.',
        requestId,
      });
    }

    if (providedWorkerSecret !== workerSecret) {
      console.warn('[WorkerAuth] Unauthorized worker access attempt');
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Worker authentication is required.',
        requestId,
      });
    }

    return null; // Valid worker request
  }

  // Fallback to Vercel Cron auth
  const cronSecrets = [process.env.INTERNAL_CRON_SECRET, process.env.CRON_SECRET].filter(Boolean) as string[];

  if (
    !cronSecret ||
    (nodeEnv !== 'test' && (cronSecret.length < 32 || weakSecrets.has(cronSecret)))
  ) {
    console.error('[CronAuth] No safe CRON_SECRET configured!');
    return apiErrorResponse('cron_not_configured', {
      status: 500,
      message: 'CRON_SECRET is not configured safely.',
      requestId,
    });
  }

  const validCronSecret = cronSecrets.find(s => nodeEnv === 'test' || (s.length >= 32 && !weakSecrets.has(s)));

  if (!validCronSecret) {
    console.error('[CronAuth] No safe CRON_SECRET configured!');
    return apiErrorResponse('cron_not_configured', {
      status: 500,
      message: 'CRON_SECRET is not configured safely.',
      requestId,
    });
  }

  const isValid = cronSecrets.some(secret => 
    providedAuthHeader === `Bearer ${secret}` || providedAuthHeader === secret
  );

  if (!isValid) {
    console.warn('[CronAuth] Unauthorized cron access attempt');
    return apiErrorResponse('unauthorized', {
      status: 401,
      message: 'Cron authentication is required.',
      requestId,
    });
  }
  
  return null; // Valid cron request
}
