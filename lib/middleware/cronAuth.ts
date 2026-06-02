// lib/middleware/cronAuth.ts
import { NextRequest, NextResponse } from 'next/server';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';

/**
 * Validate that a cron request is authentic.
 * Vercel Cron sets the Authorization header with CRON_SECRET.
 */
export function validateCronRequest(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const requestId = getRequestId(req);
  const weakSecrets = new Set([
    'super_secret_cron_token_123',
    'test-secret',
    'changeme',
    'change-me',
    'secret',
    'cron_secret',
  ]);
  
  if (
    !secret ||
    (process.env.NODE_ENV !== 'test' && (secret.length < 24 || weakSecrets.has(secret)))
  ) {
    console.error('[CronAuth] CRON_SECRET not configured or using default!');
    return apiErrorResponse('cron_not_configured', {
      status: 500,
      message: 'CRON_SECRET is not configured safely.',
      requestId,
    });
  }

  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${secret}`;
  
  if (authHeader !== expected) {
    console.warn('[CronAuth] Unauthorized cron access attempt');
    return apiErrorResponse('unauthorized', {
      status: 401,
      message: 'Cron authentication is required.',
      requestId,
    });
  }
  
  return null; // valid
}
