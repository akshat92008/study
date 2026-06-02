import { EventWorkerService } from '../lib/events/worker';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function drain() {
  console.log("Draining queue...");
  while (true) {
    const res = await EventWorkerService.processBatch(50, 10, 60_000, Date.now());
    console.log("Processed batch:", res);
    
    // If no events were processed or skipped, and DLQ didn't increase, the queue is likely empty
    if (res.processed === 0 && res.failed === 0 && res.skipped === 0) {
      break;
    }
  }
  console.log("Queue drained.");
}
drain().catch(console.error);
