import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

const modeArg = process.argv.find((arg) => arg.startsWith('--mode='));
const mode = modeArg?.split('=')[1] || process.env.APP_LAUNCH_MODE || (process.env.NODE_ENV === 'production' ? 'public_paid' : 'local');

// Critical requirements for all environments
const required = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INTERNAL_CRON_SECRET',
];

if (process.env.SKIP_ENV_VALIDATION === '1' && mode !== 'public_paid') {
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

console.log('--- Environment Preflight ---');
console.log(`Launch Mode: ${mode}`);

for (const key of required) {
  if (!process.env[key]) {
    console.error(`[ERROR] Missing required env var: ${key}`);
    ok = false;
  }
}

// Provider Availability
const activeProviders = aiProviders.filter((key) => Boolean(process.env[key]));
if (activeProviders.length === 0) {
  console.error(`[ERROR] At least one AI provider env var is required.`);
  ok = false;
} else {
  console.log(`[OK] Active AI providers: ${activeProviders.length}`);
}

function checkWeakSecret(name: string, value: string | undefined) {
  if (!value) return;
  const lower = value.toLowerCase();
  if (['changeme', 'test', 'secret'].includes(lower)) {
    console.error(`[ERROR] ${name} uses a known weak value.`);
    ok = false;
  }
  if (mode === 'public_paid' && value.length < 32) {
    console.error(`[ERROR] ${name} is too short (< 32 chars) for public_paid mode.`);
    ok = false;
  }
}

checkWeakSecret('INTERNAL_CRON_SECRET', process.env.INTERNAL_CRON_SECRET);
checkWeakSecret('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY);

if (mode === 'public_paid') {
  const publicPaidRequired = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    'SENTRY_DSN',
    'NEXT_PUBLIC_APP_URL',
    'SUPPORT_EMAIL',
    'TERMS_URL',
    'PRIVACY_URL'
  ];

  for (const key of publicPaidRequired) {
    if (!process.env[key]) {
      console.error(`[ERROR] Missing public_paid env var: ${key}`);
      ok = false;
    }
  }

  // Enforce HTTPS in production URL
  if (process.env.NEXT_PUBLIC_APP_URL && !process.env.NEXT_PUBLIC_APP_URL.startsWith('https://')) {
    console.error(`[ERROR] NEXT_PUBLIC_APP_URL must use https:// in public_paid mode.`);
    ok = false;
  }

  // Reject dangerous flags
  const dangerousFlags = [
    'BYPASS_ALL_LIMITS',
    'ALLOW_USAGE_GATE_FAIL_OPEN',
    'SKIP_ENV_VALIDATION',
    'DISABLE_EMBEDDINGS'
  ];
  for (const flag of dangerousFlags) {
    if (process.env[flag] === 'true' || process.env[flag] === '1') {
      console.error(`[ERROR] Dangerous flag ${flag} is not allowed in public_paid mode.`);
      ok = false;
    }
  }
}

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
if (!fs.existsSync(migrationsDir) || fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).length === 0) {
  console.error('[ERROR] No Supabase migrations found.');
  ok = false;
}

// Admin protection: at least one of ADMIN_EMAILS or ADMIN_USER_IDS must be configured
const adminEmails = (process.env.ADMIN_EMAILS ?? '').trim();
const adminUserIds = (process.env.ADMIN_USER_IDS ?? '').trim();
if (!adminEmails && !adminUserIds) {
  console.error('[ERROR] Admin protection not configured — set ADMIN_EMAILS or ADMIN_USER_IDS.');
  ok = false;
}

if (!ok) {
  console.error(`Environment preflight failed for mode: ${mode}`);
  process.exit(1);
}

console.log(`Environment preflight passed for mode: ${mode}`);
