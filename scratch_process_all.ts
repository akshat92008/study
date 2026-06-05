import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
import { EventWorkerService } from './lib/events/worker';

async function processAll() {
  let pending = 1;
  while (pending > 0) {
    const start = Date.now();
    const result = await EventWorkerService.processBatch(25, 5, 50000, start);
    const health = await EventWorkerService.getHealthSummary();
    pending = health.pendingEvents;
    console.log(`Processed ${result.processed}, Failed ${result.failed}, Pending left: ${pending}`);
    if (result.processed === 0 && pending > 0) {
      console.log('No events processed but pending > 0. Maybe locks? Breaking.');
      break;
    }
  }
  console.log('Done!');
}

processAll().catch(console.error);
