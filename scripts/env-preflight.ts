import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] || (process.env.NODE_ENV === 'production' ? 'production' : 'local');
const isProductionMode = mode === 'production';

const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
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

for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`);
    ok = false;
  }
}

if (!aiProviders.some((key) => Boolean(process.env[key]))) {
  console.error(`At least one AI provider env var is required: ${aiProviders.join(', ')}`);
  ok = false;
}

if (isProductionMode) {
  for (const key of ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN']) {
    if (!process.env[key]) {
      console.error(`Missing production env var: ${key}`);
      ok = false;
    }
  }

  if (!process.env.NEXT_PUBLIC_APP_URL && !process.env.VERCEL_PROJECT_PRODUCTION_URL && !process.env.VERCEL_URL) {
    console.error('Missing production URL/domain env var: NEXT_PUBLIC_APP_URL, VERCEL_PROJECT_PRODUCTION_URL, or VERCEL_URL');
    ok = false;
  }
}

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir) || fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).length === 0) {
  console.error('No Supabase migrations found.');
  ok = false;
}

if (!ok) process.exit(1);
console.log(`Environment preflight passed (${mode}).`);
