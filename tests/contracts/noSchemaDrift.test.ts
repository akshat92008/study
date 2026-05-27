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
      if (file.endsWith("noSchemaDrift.test.ts")) continue;
      if (file.endsWith("auditDbCalls.ts")) continue;
      const text = fs.readFileSync(file, "utf8");
      for (const token of forbidden) {
        if (text.includes(token)) offenders.push(`${file}: ${token}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
