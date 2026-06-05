import fs from 'fs';
import path from 'path';

const root = process.cwd();

function assertFile(relativePath: string) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) throw new Error(`Missing ${relativePath}`);
  return fs.readFileSync(fullPath, 'utf8');
}

function assertIncludes(content: string, needle: string, label: string) {
  if (!content.includes(needle)) throw new Error(`${label} is missing ${needle}`);
}

function main() {
  const access = assertFile('lib/access/beta-access.ts');
  for (const exportName of ['getUserAccessState', 'requireBetaAccess', 'requireActiveBetaUser', 'canUseFeature', 'assertFeatureAccess']) {
    assertIncludes(access, exportName, 'beta access layer');
  }

  const limits = assertFile('lib/billing/plan-limits.ts');
  if (limits.includes('Number.MAX_SAFE_INTEGER')) throw new Error('Plan limits must not use Number.MAX_SAFE_INTEGER');
  for (const plan of ['free', 'founding', 'pro', 'admin']) assertIncludes(limits, `${plan}:`, 'plan limits');

  const usage = assertFile('lib/usage/enforce-feature-limit.ts');
  for (const feature of ['chat_message', 'ai_call', 'autopsy_report', 'material_upload', 'material_query', 'hermes_write']) {
    assertIncludes(usage, feature, 'usage enforcement');
  }

  const migration = assertFile('supabase/migrations/20260605090000_manual_beta_hardening.sql');
  for (const table of ['feature_usage_events', 'app_error_events', 'admin_audit_log']) {
    assertIncludes(migration, table, 'manual beta migration');
  }

  const billing = assertFile('lib/utils/billing.ts');
  if (billing.includes('Number.MAX_SAFE_INTEGER')) throw new Error('Legacy billing still contains Number.MAX_SAFE_INTEGER');

  console.log('[OK] Beta schema/code contract passed.');
}

try {
  main();
} catch (error: any) {
  console.error('[FAIL]', error.message);
  process.exit(1);
}
