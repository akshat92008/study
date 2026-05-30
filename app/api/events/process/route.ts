import { NextRequest } from 'next/server';
import { processEventWorkerRoute } from '@/lib/events/worker-route';

export async function POST(req: NextRequest) {
  return processEventWorkerRoute(req);
}
