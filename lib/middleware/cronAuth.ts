// lib/middleware/cronAuth.ts
import { NextRequest, NextResponse } from 'next/server';

/**
 * Validate that a cron request is authentic.
 * Vercel Cron sets the Authorization header with CRON_SECRET.
 */
export function validateCronRequest(req: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  
  if (!secret || secret === 'super_secret_cron_token_123') {
    console.error('[CronAuth] CRON_SECRET not configured or using default!');
    return NextResponse.json(
      { error: 'Cron not configured' },
      { status: 500 }
    );
  }

  const authHeader = req.headers.get('authorization');
  const expected = `Bearer ${secret}`;
  
  if (authHeader !== expected) {
    console.warn('[CronAuth] Unauthorized cron access attempt');
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }
  
  return null; // valid
}
