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
export async function PATCH() {
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
