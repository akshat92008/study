import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function readIfExists(file: string) {
  const full = path.join(root, file);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
}

function walkRoutes(dir: string): string[] {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];

  return fs.readdirSync(full).flatMap((entry) => {
    const child = path.join(full, entry);
    const stat = fs.statSync(child);
    if (stat.isDirectory()) {
      return walkRoutes(path.relative(root, child));
    }
    return entry === 'route.ts' ? [path.relative(root, child).replaceAll('\\', '/')] : [];
  });
}

function usesCronBoundary(text: string) {
  return (
    text.includes('validateCronRequest') ||
    text.includes('processEventWorkerRoute') ||
    text.includes('eventWorkerHealthRoute')
  );
}

describe('admin/internal auth boundaries', () => {
  it('keeps every admin route on requireAdmin and away from cron auth', () => {
    const offenders: string[] = [];

    for (const file of walkRoutes('app/api/admin')) {
      const text = readIfExists(file);
      if (!text.includes('requireAdmin')) offenders.push(`${file}: missing requireAdmin`);
      if (usesCronBoundary(text) || text.includes('authorization') || text.includes('Bearer ${secret}')) {
        offenders.push(`${file}: uses cron auth`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('keeps every internal route on cron auth or a cron-authenticated delegate', () => {
    const offenders: string[] = [];

    for (const file of walkRoutes('app/api/internal')) {
      const text = readIfExists(file);
      if (!usesCronBoundary(text)) offenders.push(`${file}: missing cron auth`);
    }

    expect(offenders).toEqual([]);
    expect(readIfExists('lib/events/worker-route.ts')).toContain('validateCronRequest');
  });
});
