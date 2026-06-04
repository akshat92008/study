/**
 * Event Queue Worker Processing Route
 * 
 * Invoked by external cron services (e.g., Cloudflare Workers, AWS EventBridge, Upstash)
 * to process pending background tasks.
 * 
 * Usage:
 *   POST or GET /api/internal/workers/process-events
 *   Header: x-internal-worker-secret: $INTERNAL_WORKER_SECRET
 * 
 * Vercel Cron usage remains supported as a backup via the Authorization header.
 */

import { eventWorkerHealthRoute, processEventWorkerRoute } from '@/lib/events/worker-route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time 60 seconds (adjust based on Vercel plan)

export async function POST(req: Request) {
  return processEventWorkerRoute(req);
}

export async function GET(req: Request) {
  return eventWorkerHealthRoute(req);
}
