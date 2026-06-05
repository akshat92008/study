import { NextRequest, NextResponse } from 'next/server';
import { getRequestId } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

function manualBetaResponse(req: NextRequest, mode: 'redirect' | 'json') {
  const requestId = getRequestId(req);
  const url = new URL('/access', req.nextUrl.origin);

  if (mode === 'redirect') {
    return NextResponse.redirect(url, { status: 303 });
  }

  return NextResponse.json(
    {
      error: 'manual_beta_access_only',
      message: 'Access is manually activated for beta users. Contact admin/support to activate founding access.',
      url: url.toString(),
      requestId,
    },
    { status: 403, headers: { 'x-request-id': requestId } },
  );
}

export function GET(req: NextRequest) {
  return manualBetaResponse(req, 'redirect');
}

export function POST(req: NextRequest) {
  return manualBetaResponse(req, 'json');
}
