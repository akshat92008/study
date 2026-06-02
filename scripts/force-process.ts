import { EventWorkerService } from '../lib/events/worker';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function run() {
  console.log("Running worker locally to process pending events...");
  const res = await EventWorkerService.processBatch(50, 10, 600_000, Date.now());
  console.log("Worker finished:", res);
}
run().catch(console.error);
