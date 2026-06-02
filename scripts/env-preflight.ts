import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] || (process.env.NODE_ENV === 'production' ? 'production' : 'local');
const isProductionMode = mode === 'production';

// Critical requirements for Beta
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INTERNAL_CRON_SECRET',
  'AI_DAILY_BUDGET_USD',
  'AI_MONTHLY_BUDGET_USD',
];

if (process.env.SKIP_ENV_VALIDATION === '1' && !isProductionMode) {
  console.log('Skipping environment validation due to SKIP_ENV_VALIDATION=1');
  process.exit(0);
}

const aiProviders = [
  'OPENAI_API_KEY',
  'GEMINI_API_KEY',
  'CEREBRAS_API_KEY',
  'GROQ_API_KEY',
  'SAMBANOVA_API_KEY',
  'CF_API_TOKEN',
  'CLOUDFLARE_API_TOKEN',
];

let ok = true;

// 1. Missing Critical Envs
console.log('--- Environment Preflight ---');
for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ERROR] Missing required env var: ${key}`);
    ok = false;
  }
}

// 2. Admin Protection Configured
if (!process.env.ADMIN_EMAILS && !process.env.ADMIN_USER_IDS) {
  console.error(`[ERROR] Admin protection not configured. Must set ADMIN_EMAILS or ADMIN_USER_IDS.`);
  ok = false;
} else {
  console.log(`[OK] Admin protection configured.`);
}

// 3. Provider Availability
const activeProviders = aiProviders.filter((key) => Boolean(process.env[key]));
if (activeProviders.length === 0) {
  console.error(`[ERROR] At least one AI provider env var is required.`);
  ok = false;
} else {
  console.log(`[OK] Active AI providers: ${activeProviders.length}`);
}

if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
  console.log(`[OK] Supabase URL present.`);
}

// 4. Weak Secret Warnings
function checkWeakSecret(name: string, value: string | undefined) {
  if (!value) return;
  const lower = value.toLowerCase();
  if (['changeme', 'test', 'secret'].includes(lower)) {
    console.error(`[ERROR] ${name} uses a known weak value.`);
    ok = false;
  }
  if (isProductionMode && value.length < 32) {
    console.error(`[ERROR] ${name} is too short (< 32 chars) for production.`);
    ok = false;
  }
}

checkWeakSecret('INTERNAL_CRON_SECRET', process.env.INTERNAL_CRON_SECRET);
checkWeakSecret('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

// 5. Beta Feature Flag State
console.log('--- Beta Feature Flags ---');
console.log(`ENABLE_AGENT_ACTIONS: ${process.env.ENABLE_AGENT_ACTIONS || 'false'}`);
console.log(`ENABLE_AI_ESCALATION: ${process.env.ENABLE_AI_ESCALATION || 'true'}`);
console.log(`ENABLE_RAG_INGESTION: ${process.env.ENABLE_RAG_INGESTION || 'true'}`);
console.log(`ENABLE_AUTOPSY_PROCESSING: ${process.env.ENABLE_AUTOPSY_PROCESSING || 'false'}`);
console.log(`ENABLE_VISION_UPLOADS: ${process.env.ENABLE_VISION_UPLOADS || 'false'}`);

// 6. Budget State
console.log('--- Budget State ---');
console.log(`AI_DAILY_BUDGET_USD: ${process.env.AI_DAILY_BUDGET_USD}`);
console.log(`AI_MONTHLY_BUDGET_USD: ${process.env.AI_MONTHLY_BUDGET_USD}`);

// 7. Worker State
console.log('--- Worker State ---');
console.log(`EVENT_WORKER_BATCH_SIZE: ${process.env.EVENT_WORKER_BATCH_SIZE || 25}`);
console.log(`EVENT_WORKER_CONCURRENCY: ${process.env.EVENT_WORKER_CONCURRENCY || 5}`);
console.log(`EVENT_WORKER_MAX_RUNTIME_MS: ${process.env.EVENT_WORKER_MAX_RUNTIME_MS || 45000}`);

if (isProductionMode) {
  for (const key of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    if (!process.env[key]) {
      console.error(`[ERROR] Missing production env var: ${key}`);
      ok = false;
    }
  }

  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL && !process.env.VERCEL_URL) {
    console.error('[ERROR] Missing production URL/domain env var: NEXT_PUBLIC_APP_URL, VERCEL_PROJECT_PRODUCTION_URL, or VERCEL_URL');
    ok = false;
  }
}

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir) || fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).length === 0) {
  console.error('[ERROR] No Supabase migrations found.');
  ok = false;
}

if (!ok) {
  console.error('Environment preflight failed.');
  process.exit(1);
}
console.log(`Environment preflight passed (${mode}).`);
