import { NextRequest, NextResponse } from 'next/server';
import { GET as systemStatusGet } from '../system/status/route';
import { requireAdmin } from '@/lib/auth/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  // Proxy to the comprehensive system status endpoint after auth
  return systemStatusGet(req);
}
