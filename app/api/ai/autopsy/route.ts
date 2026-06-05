import { NextResponse } from 'next/server';

// /api/ai/autopsy was a re-export of the legacy /api/autopsy/ingest route.
// Legacy Autopsy is disabled — use /api/autopsy/v3/assessments instead.

export async function POST() {
  return NextResponse.json(
    {
      error: 'legacy_autopsy_disabled',
      message: 'Legacy Autopsy is disabled. Use Autopsy V3.',
      replacement: '/api/autopsy/v3/assessments',
      retryable: false,
    },
    { status: 410 }
  );
}