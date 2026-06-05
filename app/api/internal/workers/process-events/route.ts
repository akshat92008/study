/**
 * Event Queue Worker Processing Route
 * 
 * Invoked by external cron services (e.g., Cloudflare Workers, AWS EventBridge, Upstash)
 * to process pending background tasks.
 * 
 * Usage:
 *   POST /api/internal/workers/process-events
 *   Header: Authorization: Bearer $INTERNAL_CRON_SECRET
 *   or x-internal-worker-secret: $INTERNAL_WORKER_SECRET
 * 
 * GET returns health only. Frequent execution is intended for external cron;
 * Vercel cron is limited to the daily synthesis route on Hobby.
 */

import { eventWorkerHealthRoute, processEventWorkerRoute } from '@/lib/events/worker-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

export async function POST(req: Request) {
  return processEventWorkerRoute(req);
}

export async function GET(req: Request) {
  return eventWorkerHealthRoute(req);
}
