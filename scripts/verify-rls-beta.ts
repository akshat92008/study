import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config();

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
if (process.env.SUPABASE_URL && process.env.SUPABASE_URL.includes('supabase.co')) {
  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('localhost')) {
    console.error('SUPABASE_URL is set to remote, but DATABASE_URL is missing or local.');
    process.exit(1);
  }
}

const userOwnedTables = [
  'profiles',
  'chat_sessions',
  'chat_messages',
  'assessments',
  'assessment_questions',
  'autopsy_reports',
  'mistake_diagnoses',
  'revision_cards',
  'learning_signals',
  'hermes_learning_memories',
  'study_materials',
  'study_material_chunks',
  'rag_ingestion_jobs',
  'daily_microtasks',
  'session_cards',
  'practice_attempts',
  'feature_usage_events',
];

const serviceOnlyTables = [
  'event_queue',
  'event_dlq',
  'consumer_locks',
  'event_attempts',
  'admin_audit_log',
  'admin_audit_logs',
  'app_error_events',
];

async function tableExists(client: Client, table: string) {
  const res = await client.query(
    `select exists (
      select 1 from information_schema.tables
      where table_schema = 'public' and table_name = $1
    )`,
    [table],
  );
  return res.rows[0]?.exists === true;
}

async function columnExists(client: Client, table: string, column: string) {
  const res = await client.query(
    `select exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = $1 and column_name = $2
    )`,
    [table, column],
  );
  return res.rows[0]?.exists === true;
}

async function rlsEnabled(client: Client, table: string) {
  const res = await client.query(
    `select relrowsecurity
     from pg_class
     join pg_namespace on pg_namespace.oid = pg_class.relnamespace
     where nspname = 'public' and relname = $1`,
    [table],
  );
  return res.rows[0]?.relrowsecurity === true;
}

async function hasUnsafePublicPolicy(client: Client, table: string) {
  const res = await client.query(
    `select policyname, roles, qual, with_check
     from pg_policies
     where schemaname = 'public' and tablename = $1`,
    [table],
  );
  return res.rows.some((row) => {
    const roles = Array.isArray(row.roles) ? row.roles : [];
    const roleText = roles.join(',');
    const qual = String(row.qual || '');
    const withCheck = String(row.with_check || '');
    return roleText.includes('public') && (qual === 'true' || withCheck === 'true');
  });
}

async function main() {
  const client = new Client({ connectionString });
  await client.connect();
  let ok = true;

  try {
    for (const table of [...userOwnedTables, ...serviceOnlyTables]) {
      if (!(await tableExists(client, table))) {
        console.warn(`[WARN] public.${table} not present; skipping`);
        continue;
      }
      if (!(await rlsEnabled(client, table))) {
        console.error(`[FAIL] public.${table} does not have RLS enabled`);
        ok = false;
      }
      if (await hasUnsafePublicPolicy(client, table)) {
        console.error(`[FAIL] public.${table} has a public policy that grants true`);
        ok = false;
      }
    }

    for (const table of userOwnedTables) {
      if ((await tableExists(client, table)) && !(await columnExists(client, table, table === 'profiles' ? 'id' : 'user_id'))) {
        console.error(`[FAIL] public.${table} is missing expected owner column`);
        ok = false;
      }
    }

    if (!ok) process.exit(1);
    console.log('[OK] Beta RLS verification passed.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error('[FATAL] Beta RLS verification failed:', error);
  process.exit(1);
});
