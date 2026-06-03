import { getAllProviderStats } from './lib/ai/provider-health';

async function check() {
  const stats = await getAllProviderStats();
  console.log(JSON.stringify(stats, null, 2));
}

check().catch(console.error);
