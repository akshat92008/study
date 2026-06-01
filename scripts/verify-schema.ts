import fs from 'fs';
import path from 'path';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');
const routesPath = path.join(root, 'lib', 'events', 'routes.ts');

type Check = {
  name: string;
  ok: boolean;
  detail?: string;
};

function readMigrationSql(): string {
  if (!fs.existsSync(migrationsDir)) {
    throw new Error(`Missing migrations directory: ${migrationsDir}`);
  }

  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n');
}

function hasAll(sql: string, values: string[]): boolean {
  return values.every((value) => sql.includes(value));
}

function hasRlsEnablement(sql: string, table: string): boolean {
  const lower = sql.toLowerCase();
  return (
    lower.includes(`alter table public.${table} enable row level security`) ||
    (lower.includes('enable row level security') && lower.includes(`'${table}'`))
  );
}

function main() {
  const sql = readMigrationSql();
  const lowerSql = sql.toLowerCase();
  const routeText = fs.existsSync(routesPath) ? fs.readFileSync(routesPath, 'utf8') : '';

  const requiredTables = [
    'public.profiles',
    'public.learning_goals',
    'public.chat_sessions',
    'public.chat_messages',
    'public.session_cards',
    'public.study_sessions',
    'public.concepts',
    'public.revision_cards',
    'public.mistakes',
    'public.mock_autopsies',
    'public.event_queue',
    'public.consumer_locks',
    'public.event_attempts',
    'public.event_dlq',
    'public.study_materials',
    'public.study_material_chunks',
    'public.rag_query_logs',
    'public.ai_usage_events',
  ];

  const requiredColumns = [
    'exam_type',
    'streak_days',
    'last_active_at',
    'learner_state_version',
    'mastery',
    'mastery_score',
    'forgetting_probability',
    'due',
    'learner_state_version',
    'content_hash',
    'needs_review',
    'evidence_status',
    'evidence',
    'idempotency_key',
  ];

  const requiredFunctions = [
    'create or replace function public.complete_study_session',
    'create or replace function public.create_event_with_consumers',
    'create or replace function public.acquire_event_leases',
    'create or replace function public.ingest_mock_autopsy',
    'create or replace function public.reserve_ai_budget',
    'create or replace function public.commit_ai_usage',
    'create or replace function public.release_ai_budget',
    'create or replace function public.match_study_material_chunks',
  ];

  const requiredRlsTables = [
    'profiles',
    'chat_sessions',
    'chat_messages',
    'session_cards',
    'study_sessions',
    'concepts',
    'revision_cards',
    'mistakes',
    'study_materials',
    'study_material_chunks',
  ];

  const requiredIndexes = [
    'idx_study_materials_user_content_hash_unique',
    'idx_study_material_chunks_material_hash_unique',
    'idx_revision_cards_unique_source',
    'idempotency_key text unique',
    'idx_consumer_locks_event',
  ];

  const requiredEvents = [
    'CHAT_MESSAGE_PROCESSED',
    'STUDY_SESSION_COMPLETED',
    'AUTOPSY_UPLOAD_RECEIVED',
    'AUTOPSY_MOCK_PROCESSED',
    'MEMORY_CARD_REVIEWED',
    'PRACTICE_ATTEMPT_RECORDED',
    'STUDENT_MODEL_SYNC_REQUESTED',
  ];

  const checks: Check[] = [
    {
      name: 'required tables appear in migrations',
      ok: hasAll(sql, requiredTables),
      detail: requiredTables.filter((value) => !sql.includes(value)).join(', '),
    },
    {
      name: 'required canonical columns appear in migrations',
      ok: hasAll(sql, requiredColumns),
      detail: requiredColumns.filter((value) => !sql.includes(value)).join(', '),
    },
    {
      name: 'required RPCs appear in migrations',
      ok: hasAll(sql, requiredFunctions),
      detail: requiredFunctions.filter((value) => !sql.includes(value)).join(', '),
    },
    {
      name: 'required RLS enablement appears in migrations',
      ok: requiredRlsTables.every((table) => hasRlsEnablement(lowerSql, table)),
      detail: requiredRlsTables.filter((table) => !hasRlsEnablement(lowerSql, table)).join(', '),
    },
    {
      name: 'required indexes and unique constraints appear in migrations',
      ok: hasAll(sql, requiredIndexes),
      detail: requiredIndexes.filter((value) => !sql.includes(value)).join(', '),
    },
    {
      name: 'TypeScript event routes include MVP events',
      ok: hasAll(routeText, requiredEvents),
      detail: requiredEvents.filter((value) => !routeText.includes(value)).join(', '),
    },
    {
      name: 'SQL event routes include MVP events',
      ok: hasAll(sql, requiredEvents),
      detail: requiredEvents.filter((value) => !sql.includes(value)).join(', '),
    },
  ];

  let passed = true;
  console.log('--- Cognition OS schema verification ---');
  for (const check of checks) {
    if (check.ok) {
      console.log(`OK ${check.name}`);
    } else {
      passed = false;
      console.error(`FAIL ${check.name}${check.detail ? `: ${check.detail}` : ''}`);
    }
  }

  if (!passed) {
    process.exit(1);
  }

  console.log('Schema verification passed.');
}

main();
