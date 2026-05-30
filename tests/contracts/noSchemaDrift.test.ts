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
});
