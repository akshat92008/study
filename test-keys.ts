import { getProviderConfig, TASK_PROVIDER_PRIORITY } from './lib/ai/providers';

async function check() {
  console.log("Checking providers...");
  for (const p of TASK_PROVIDER_PRIORITY['stream'] || []) {
    const config = getProviderConfig(p);
    console.log(`${p}: hasConfig=${!!config}, hasKey=${!!config?.apiKey}`);
  }
}
check().catch(console.error);
