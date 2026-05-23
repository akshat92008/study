import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates that the incoming request carries the correct CRON_SECRET.
 * Vercel passes this via the Authorization header when it invokes crons.
 * Returns a 401 Response if invalid, or null if valid (proceed normally).
 */
export function validateCronSecret(req: NextRequest): NextResponse | null {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('[CRON] CRON_SECRET env var is not set. Cron endpoint is unsecured.');
    // In production, block the request entirely if the secret is missing
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Cron not configured' }, { status: 500 });
    }
    // In dev, allow without secret so you can test locally
    return null;
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null; // valid — caller proceeds
}
