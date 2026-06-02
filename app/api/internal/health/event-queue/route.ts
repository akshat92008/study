import { eventWorkerHealthRoute } from '@/lib/events/worker-route';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return eventWorkerHealthRoute(req);
}
