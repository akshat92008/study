import { NextResponse } from 'next/server';
export async function GET() {
  return NextResponse.json(
    {
      error: 'legacy_autopsy_disabled',
      message: 'Legacy Autopsy is disabled. Use Autopsy V3.',
      replacement: '/api/autopsy/v3',
      retryable: false,
    },
    { status: 410 }
  );
}
export async function POST() {
  // Hard-disable legacy ingest to force V3 path
  return NextResponse.json(
    {
      error: 'Legacy autopsy ingest is disabled. Use the new Deep Autopsy V3 flow.',
      replacement: '/dashboard/autopsy', // Point to dashboard entry
    },
    { status: 410 }
  );
}
export async function PATCH() {
  // Hard-disable legacy ingest to force V3 path
  return NextResponse.json(
    {
      error: 'Legacy autopsy ingest is disabled. Use the new Deep Autopsy V3 flow.',
      replacement: '/dashboard/autopsy', // Point to dashboard entry
    },
    { status: 410 }
  );
}
