import { NextResponse } from 'next/server';

export const maxDuration = 10;

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: 'Deprecated. Please use /api/internal/workers/process-events with an external cron runner.',
  }, { status: 410 });
}

export async function GET() {
  return POST();
}
