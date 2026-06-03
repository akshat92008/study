import { getProviderConfig, TASK_PROVIDER_PRIORITY } from './lib/ai/providers';

async function check() {
  const providers = TASK_PROVIDER_PRIORITY['stream'];
  console.log("Stream providers:", providers);
  for (const p of providers) {
    const config = getProviderConfig(p);
    console.log(p, !!config, !!config?.apiKey);
  }
}
check().catch(console.error);
