import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 10;

import { validateCronRequest } from '@/lib/middleware/cronAuth';

export async function POST(req: NextRequest) {
  const authErr = validateCronRequest(req);
  if (authErr) return authErr;

  return NextResponse.json({
    ok: false,
    message: 'Deprecated. Please use /api/internal/workers/process-events with an external cron runner.',
  }, { status: 410 });
}

export async function GET(req: NextRequest) {
  return POST(req);
}
