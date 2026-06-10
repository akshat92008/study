import { getAppLaunchMode, isFeatureEnabled, getFeatureLimits } from '../lib/feature-registry';

console.log('--- Launch Configuration ---');
console.log(`Mode: ${getAppLaunchMode()}`);

console.log('\n--- Enabled Features ---');
const features = ['chat', 'practice', 'rag_upload', 'rag_query', 'autopsy_report', 'hermes_write', 'worker_ai', 'atlas', 'analytics_ui'];
for (const f of features) {
  console.log(`${f}: ${isFeatureEnabled(f as any) ? '✅' : '❌'}`);
}

console.log('\n--- Limits ---');
console.log(JSON.stringify(getFeatureLimits(), null, 2));
