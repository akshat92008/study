// Audit script to find Supabase DB calls (select, insert, update, rpc) in the codebase
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const extensions = ['.ts', '.tsx'];

function isRelevant(file: string) {
  return !file.includes('node_modules') && !file.includes('.next');
}

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (!isRelevant(full)) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (extensions.includes(path.extname(full))) files.push(full);
  }
  return files;
}

const patterns = [/\.select\(/, /\.insert\(/, /\.update\(/, /\.rpc\(/];

function audit() {
  const offenders: { file: string; line: number; snippet: string }[] = [];
  const files = walk(root);
  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    lines.forEach((line, idx) => {
      if (patterns.some(p => p.test(line))) {
        offenders.push({ file, line: idx + 1, snippet: line.trim() });
      }
    });
  }
  if (offenders.length === 0) {
    console.log('✅ No raw Supabase DB calls found.');
    process.exit(0);
  }
  console.log('⚠️ Potential raw DB calls detected:');
  offenders.forEach(o => console.log(`${o.file}:${o.line} -> ${o.snippet}`));
  process.exit(1);
}

audit();
