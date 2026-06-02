import { EventWorkerService } from '../lib/events/worker';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function processQueue() {
  console.log('Processing remaining queue events (MATERIAL_UPLOADED)...');
  try {
    const res = await EventWorkerService.processBatch(25, 5, 50_000, Date.now());
    console.log('Processed:', res);
  } catch (e) {
    console.error('Error processing:', e);
  }
}

processQueue().catch(console.error);
