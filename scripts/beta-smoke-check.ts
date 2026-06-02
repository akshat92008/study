import path from 'path';
import dotenv from 'dotenv';
import { getRagConfig } from '../lib/rag/config';
import { featureFlags } from '../lib/config/flags';

dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config();

let ok = true;

function checkRequired(key: string) {
  if (!process.env[key]) {
    console.error(`[ERROR] Missing required env var: ${key}`);
    ok = false;
  }
}

console.log('--- Beta 10 Smoke Check ---');

// 1. Critical Supabase and Auth
checkRequired('NEXT_PUBLIC_SUPABASE_URL');
checkRequired('NEXT_PUBLIC_SUPABASE_ANON_KEY');
checkRequired('SUPABASE_SERVICE_ROLE_KEY');

const cronSecret = process.env.INTERNAL_CRON_SECRET;
if (!cronSecret) {
  console.error('[ERROR] Missing INTERNAL_CRON_SECRET');
  ok = false;
} else if (cronSecret.length < 32) {
  console.error('[ERROR] INTERNAL_CRON_SECRET is too short (< 32 chars)');
  ok = false;
}

if (!process.env.ADMIN_EMAILS && !process.env.ADMIN_USER_IDS) {
  console.error('[ERROR] Missing admin allowlist (ADMIN_EMAILS or ADMIN_USER_IDS)');
  ok = false;
}

const dailyBudget = Number(process.env.AI_DAILY_BUDGET_USD);
if (!dailyBudget || dailyBudget <= 0) {
  console.error('[ERROR] AI_DAILY_BUDGET_USD must be set and > 0');
  ok = false;
} else if (dailyBudget > 10) {
  console.warn('[WARN] AI_DAILY_BUDGET_USD might be high for beta');
} else if (dailyBudget < 1) {
  console.warn('[WARN] AI_DAILY_BUDGET_USD might be too low for beta');
}

const monthlyBudget = Number(process.env.AI_MONTHLY_BUDGET_USD);
if (!monthlyBudget || monthlyBudget <= 0) {
  console.error('[ERROR] AI_MONTHLY_BUDGET_USD must be set and > 0');
  ok = false;
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
const activeProviders = aiProviders.filter((key) => Boolean(process.env[key]));
if (activeProviders.length === 0) {
  console.error('[ERROR] At least one AI provider key is required');
  ok = false;
}

console.log('--- Feature Flags ---');
const flags = {
  ENABLE_AGENT_ACTIONS: featureFlags.agentActions(),
  ENABLE_RAG_INGESTION: featureFlags.ragIngestion(),
  ENABLE_AUTOPSY_PROCESSING: featureFlags.autopsyProcessing(),
  ENABLE_VISION_UPLOADS: featureFlags.visionUploads(),
};

console.log(JSON.stringify(flags, null, 2));

if (flags.ENABLE_AGENT_ACTIONS) console.warn('[WARN] Agent actions enabled for beta');
if (flags.ENABLE_AUTOPSY_PROCESSING) console.warn('[WARN] Autopsy processing enabled for first beta');
if (flags.ENABLE_VISION_UPLOADS) console.warn('[WARN] Vision uploads enabled for beta');

console.log('--- RAG Limits ---');
const ragConfig = getRagConfig();
console.log(JSON.stringify(ragConfig, null, 2));

if (ragConfig.maxChunksPerFile > 80) {
  console.warn(`[WARN] RAG max chunks (${ragConfig.maxChunksPerFile}) > 80`);
}

console.log('--- Worker Settings ---');
console.log(`EVENT_WORKER_BATCH_SIZE: ${process.env.EVENT_WORKER_BATCH_SIZE || 25}`);
console.log(`EVENT_WORKER_CONCURRENCY: ${process.env.EVENT_WORKER_CONCURRENCY || 5}`);
console.log(`EVENT_WORKER_MAX_RUNTIME_MS: ${process.env.EVENT_WORKER_MAX_RUNTIME_MS || 45000}`);

if (!ok) {
  console.error('\n[FAIL] Beta smoke check failed.');
  process.exit(1);
}

console.log('\n[PASS] Beta smoke check passed.');
