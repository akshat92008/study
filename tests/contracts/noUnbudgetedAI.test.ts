import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const forbiddenTokens = [
  'routeVisionCall(',
  'routeTextGeneration(',
  'routeJSONGeneration(',
  'routeStreamGeneration(',
  'generateJSON(',
  'generateText(',
  'streamText(',
  'handleVisionMessage(',
];

const approvedFiles = new Set([
  'lib/ai/router.ts',
  'lib/ai/provider-client.ts',
  'lib/ai/budgeted.ts',
  'lib/agent/modelPlanner.ts',
]);

function walk(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      if (['node_modules', '.next', 'dist', 'coverage'].includes(item)) continue;
      walk(full, files);
    }
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

function stripComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

describe('No unbudgeted AI primitives', () => {
  it('keeps low-level AI primitive calls inside approved budget/router files', () => {
    const offenders: string[] = [];

    for (const dir of ['app', 'lib']) {
      const fullDir = path.join(root, dir);
      if (!fs.existsSync(fullDir)) continue;

      for (const file of walk(fullDir)) {
        const relative = path.relative(root, file).replaceAll('\\', '/');
        if (approvedFiles.has(relative)) continue;

        const raw = fs.readFileSync(file, 'utf8');
        if (raw.includes('budget-exempt:')) continue;

        const text = stripComments(raw);
        for (const token of forbiddenTokens) {
          if (text.includes(token)) offenders.push(`${relative}: ${token}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
