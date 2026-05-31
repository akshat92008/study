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
    const allowedStorageBuckets = new Set<string>();
    const missing: string[] = [];

    for (const [name, files] of refs) {
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
