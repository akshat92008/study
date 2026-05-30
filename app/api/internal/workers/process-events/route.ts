import { eventWorkerHealthRoute, processEventWorkerRoute } from '@/lib/events/worker-route';

export const maxDuration = 60; // Max execution time 60 seconds (adjust based on Vercel plan)

export async function POST(req: Request) {
  return processEventWorkerRoute(req);
}

export async function GET(req: Request) {
  return eventWorkerHealthRoute(req);
}
