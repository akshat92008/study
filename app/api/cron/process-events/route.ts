import { NextRequest } from 'next/server';
import { processEventWorkerRoute } from '@/lib/events/worker-route';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  return processEventWorkerRoute(req);
}

export async function GET(req: NextRequest) {
  return POST(req);
}
