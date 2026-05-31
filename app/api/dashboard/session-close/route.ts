import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json(
    {
      error: 'deprecated_route',
      message: 'Use /api/dashboard/complete-session for MVP session completion.',
    },
    { status: 404 }
  );
}
