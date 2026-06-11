import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const forbidden = [
  "next_review",
  "last_study_date",
  "last_session_date",
  "friction_score",
  "signal_data",
  "detected_at",
  "mastery_level",
  "usePulseCollector",
  "PulseListener",
  "users(id)",
];

function walk(dir: string, files: string[] = []): string[] {
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (full.includes("node_modules") || full.includes(".next") || full.includes("scratch") || full.includes("temp_neetapp")) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function migrationObjects() {
  const migrationsDir = path.join(root, 'supabase', 'migrations');
  const tables = new Set<string>();
  const views = new Set<string>();
  const functions = new Set<string>();

  for (const file of fs.readdirSync(migrationsDir)) {
    if (!file.endsWith('.sql')) continue;
    const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?([a-zA-Z_][\w-]*)/gi)) {
      tables.add(match[1]);
    }
    for (const match of text.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?"(?:public|auth)"\."([^"]+)"/gi)) {
      tables.add(match[1]);
    }
    for (const match of text.matchAll(/create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?([a-zA-Z_][\w-]*)/gi)) {
      views.add(match[1]);
    }
    for (const match of text.matchAll(/create\s+(?:or\s+replace\s+)?function\s+(?:public\.)?([a-zA-Z_][\w]*)/gi)) {
      functions.add(match[1]);
    }
  }

  return { tables, views, functions };
}

function runtimeDbRefs() {
  const runtimeDirs = ['app', 'components', 'lib', 'stores'];
  const refs = new Map<string, Set<string>>();
  const storageBuckets = new Map<string, Set<string>>();

  for (const dir of runtimeDirs) {
    const fullDir = path.join(root, dir);
    if (!fs.existsSync(fullDir)) continue;

    for (const file of walk(fullDir)) {
      const relative = path.relative(root, file);
      if (relative.includes('lib/db/migrations_deprecated')) continue;

      const text = stripComments(fs.readFileSync(file, 'utf8'));
      for (const match of text.matchAll(/\.from\(\s*['"]([^'"]+)['"]\s*\)|\.rpc\(\s*['"]([^'"]+)['"]\s*\)|storage\.from\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        const tableOrRpc = match[1] || match[2];
        const bucket = match[3];
        if (tableOrRpc) {
          if (!refs.has(tableOrRpc)) refs.set(tableOrRpc, new Set());
          refs.get(tableOrRpc)!.add(relative);
        }
        if (bucket) {
          if (!storageBuckets.has(bucket)) storageBuckets.set(bucket, new Set());
          storageBuckets.get(bucket)!.add(relative);
        }
      }
    }
  }

  return { refs, storageBuckets };
}

describe("schema drift", () => {
  it("does not use removed database fields", () => {
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (file.endsWith('noSchemaDrift.test.ts')) continue;
      if (file.includes('scripts/') || file.includes('lib/db/schema.ts')) continue;
      if (file.endsWith("auditDbCalls.ts")) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const token of forbidden) {
        if (text.includes(token)) offenders.push(`${file}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no deprecated Gemini imports in runtime files", () => {
    const offenders: string[] = [];
    for (const file of walk(root)) {
      if (file.endsWith('noSchemaDrift.test.ts') || file.endsWith('chatPersistence.test.ts')) continue;
      if (file.endsWith('gemini.ts')) continue; 
      if (file.includes('scripts/') || file.includes('lib/db/schema.ts')) continue;
      const text = fs.readFileSync(file, "utf8");
      if (text.includes('@/lib/ai/gemini') || text.includes('lib/ai/gemini')) {
        offenders.push(`${file}: uses deprecated @/lib/ai/gemini`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('migration contracts', () => {
  it('no migration references users(id) instead of profiles(id)', () => {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    const offenders: string[] = [];
    for (const file of fs.readdirSync(migrationsDir)) {
      if (!file.endsWith('.sql')) continue;
      const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (text.includes('REFERENCES users(id)')) {
        offenders.push(`${file}: uses REFERENCES users(id) — should be profiles(id)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has unique Supabase migration versions', () => {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    const versions = new Map<string, string[]>();
    for (const file of fs.readdirSync(migrationsDir)) {
      if (!file.endsWith('.sql')) continue;
      const version = file.split('_')[0];
      versions.set(version, [...(versions.get(version) || []), file]);
    }
    const duplicates = Array.from(versions.entries())
      .filter(([, files]) => files.length > 1)
      .map(([version, files]) => `${version}: ${files.join(', ')}`);

    expect(duplicates).toEqual([]);
  });

  it('profile trigger migration has search_path', () => {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    let found = false;
    let hasSearchPath = false;
    for (const file of fs.readdirSync(migrationsDir)) {
      if (!file.endsWith('.sql')) continue;
      const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (text.includes('handle_new_user')) {
        found = true;
        if (text.includes('SET search_path = public')) {
          hasSearchPath = true;
        }
      }
    }
    expect(found).toBe(true);
    expect(hasSearchPath).toBe(true);
  });

  it('runtime table and RPC references exist in active migrations', () => {
    const { tables, views, functions } = migrationObjects();
    const { refs, storageBuckets } = runtimeDbRefs();
    const allowedStorageBuckets = new Set<string>(['study-materials', 'autopsy-evidence']);
    // RPCs/tables that are intentionally referenced but may not appear in migration CREATE TABLE statements.
    // delete_own_account: optional user-facing RPC; fallback path exists if missing.
    // goals / learning_materials: legacy aliases for learning_goals / study_materials — fixed in source, kept for transition.
    const knownAllowedRefs = new Set<string>([
      'delete_own_account',
      'goals',
      'learning_materials',
    ]);
    const missing: string[] = [];

    for (const [name, files] of refs) {
      if (allowedStorageBuckets.has(name)) continue;
      if (knownAllowedRefs.has(name)) continue;
      if (tables.has(name) || views.has(name) || functions.has(name)) continue;
      missing.push(`${name}: ${Array.from(files).sort().join(', ')}`);
    }

    for (const [bucket, files] of storageBuckets) {
      if (allowedStorageBuckets.has(bucket)) continue;
      missing.push(`storage:${bucket}: ${Array.from(files).sort().join(', ')}`);
    }

    expect(missing.sort()).toEqual([]);
  });
});

// ============================================================
// Module 4: Static RLS Audit
// ============================================================
describe('rls audit', () => {
  const CORE_USER_TABLES = [
    'profiles',
    'learning_goals',
    'study_sessions',
    'session_cards',
    'chat_sessions',
    'chat_messages',
    'study_materials',
    'mock_autopsies',
    'autopsy_reports',
    'concepts',
    'revision_cards',
    'mistakes',
    'ai_usage_daily',
    'agent_runs',
  ] as const;

  function getMigrationContent(): string {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    return fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n');
  }

  it('all core user-data tables have RLS enabled in migrations', () => {
    const content = getMigrationContent().toLowerCase();
    const missing: string[] = [];

    for (const table of CORE_USER_TABLES) {
      const hasRls = content.includes(`alter table public.${table} enable row level security`) ||
                     content.includes(`alter table ${table} enable row level security`) ||
                     content.includes(`alter table "public"."${table}" enable row level security`);
      if (!hasRls) {
        missing.push(table);
      }
    }

    expect(missing).toEqual([]);
  });

  it('all core user-data tables have FORCE ROW LEVEL SECURITY in latest hardening migration', () => {
    const hardeningMigration = fs.readFileSync(
      path.join(root, 'supabase', 'migrations', 'archived_legacy', '20260610000000_public_launch_rls_hardening.sql'),
      'utf8'
    ).toLowerCase();

    const missing: string[] = [];
    for (const table of CORE_USER_TABLES) {
      if (!hardeningMigration.includes(`alter table public.${table} force row level security`)) {
        missing.push(table);
      }
    }

    expect(missing).toEqual([]);
  });

  it('no RLS policy references the deprecated auth.email() function', () => {
    const content = getMigrationContent();
    const offenders: string[] = [];

    const migrationsDir = path.join(root, 'supabase', 'migrations');
    for (const file of fs.readdirSync(migrationsDir)) {
      if (!file.endsWith('.sql')) continue;
      const text = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      if (text.includes('auth.email()')) {
        offenders.push(file);
      }
    }

    // auth.email() is deprecated in Supabase — should use auth.jwt() instead
    expect(offenders).toEqual([]);
  });
});

// ============================================================
// Module 4: Launch-Critical Column Contracts (static)
// ============================================================
describe('launch-critical schema columns', () => {
  const REQUIRED_COLUMNS: Record<string, string[]> = {
    profiles: [
      'exam_type',
      'streak_days',
      'last_active_at',
      'learner_state_version',
      'stripe_customer_id',
      'subscription_status',
      'manual_plan',
      'onboarding_complete',
      'timezone',
    ],
    revision_cards: ['normalized_key'],
    session_cards: ['goal_key'],
    concepts: ['mastery_score', 'mastery', 'concept_key'],
    mistakes: ['idempotency_key'],
    learner_events: ['idempotency_key'],
    agent_runs: ['goal_id', 'channel', 'plan', 'mutation_summary'],
    autopsy_reports: ['status', 'generated_by'],
  };

  function getMigrationContent(): string {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    return fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n')
      .toLowerCase();
  }

  it('all launch-critical columns are declared in migrations', () => {
    const content = getMigrationContent();
    const missing: string[] = [];

    for (const [table, columns] of Object.entries(REQUIRED_COLUMNS)) {
      for (const column of columns) {
        const colLower = column.toLowerCase();
        const tableAndCol = content.includes(`"${table}"`) || content.includes(table);
        const declared =
          content.includes(`add column if not exists ${colLower}`) ||
          content.includes(`add column ${colLower}`) ||
          // Column might be in CREATE TABLE
          (content.includes(`create table`) && content.includes(colLower));

        if (!declared || !tableAndCol) {
          missing.push(`${table}.${column}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });
});

// ============================================================
// Module 4: Required RPC Contracts
// ============================================================
describe('required rpc contracts', () => {
  const REQUIRED_RPCS = [
    'complete_study_session',
    'upsert_session_card',
    'check_and_increment_usage_gate',
    'create_event_with_consumers',
  ] as const;

  it('all required RPCs are defined in migrations', () => {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    const content = fs.readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8'))
      .join('\n')
      .toLowerCase();

    const missing: string[] = [];
    for (const rpc of REQUIRED_RPCS) {
      if (!content.includes(`function ${rpc}`) && !content.includes(`function public.${rpc}`)) {
        missing.push(rpc);
      }
    }

    expect(missing).toEqual([]);
  });
});

