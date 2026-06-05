import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function POST() {
  return NextResponse.json({
    received: true,
    ignored: true,
    reason: 'manual_beta_access_only',
  });
}
