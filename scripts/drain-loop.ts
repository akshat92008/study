/**
 * scripts/drain-loop.ts
 *
 * Bounded event queue drain — safe for manual admin use.
 * Replaces the former unbounded loop.
 *
 * Safety caps:
 *   DRAIN_MAX_BATCHES   — max iterations before forced stop (default 20)
 *   Empty-batch break   — exits early when queue is empty
 */
import { EventWorkerService } from '../lib/events/worker';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MAX_BATCHES = Number(process.env.DRAIN_MAX_BATCHES ?? 20);
const BATCH_SIZE = Number(process.env.EVENT_WORKER_BATCH_SIZE ?? 25);
const CONCURRENCY = Number(process.env.EVENT_WORKER_CONCURRENCY ?? 5);
const MAX_RUNTIME_MS = Number(process.env.EVENT_WORKER_MAX_RUNTIME_MS ?? 30_000);

async function drain() {
  console.log(`[drain-loop] Starting. MAX_BATCHES=${MAX_BATCHES}, BATCH_SIZE=${BATCH_SIZE}`);
  let totalProcessed = 0;
  let totalFailed = 0;

  for (let i = 0; i < MAX_BATCHES; i++) {
    const res = await EventWorkerService.processBatch(BATCH_SIZE, CONCURRENCY, MAX_RUNTIME_MS, Date.now());
    console.log(`[drain-loop] Batch ${i + 1}/${MAX_BATCHES}:`, res);
    totalProcessed += res.processed ?? 0;
    totalFailed += res.failed ?? 0;

    // Empty queue — exit early
    if ((res.processed ?? 0) === 0 && (res.failed ?? 0) === 0 && (res.skipped ?? 0) === 0) {
      console.log(`[drain-loop] Queue empty after ${i + 1} batch(es). Exiting.`);
      break;
    }

    if (i === MAX_BATCHES - 1) {
      console.warn(`[drain-loop] Reached MAX_BATCHES=${MAX_BATCHES} limit. Stopping to prevent runaway.`);
    }
  }

  console.log(`[drain-loop] Done. processed=${totalProcessed}, failed=${totalFailed}`);
}

drain().catch((err) => {
  console.error('[drain-loop] Fatal error:', err);
  process.exit(1);
});
