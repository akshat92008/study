import { NextRequest } from 'next/server';
import { GET as systemStatusGet } from '../system/status/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Proxy to the comprehensive system status endpoint
  return systemStatusGet(req);
}
