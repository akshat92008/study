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
    if (full.includes("node_modules") || full.includes(".next")) continue;
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
      if (file.includes('/services/')) continue;
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
    const migrationsDir = path.join(root, 'lib', 'db', 'migrations');
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
});
