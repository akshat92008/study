import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function routeFiles(dir: string, files: string[] = []): string[] {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) routeFiles(full, files);
    else if (item === 'route.ts') files.push(full);
  }
  return files;
}

describe('internal route auth contract', () => {
  it('protects cron/internal/event worker routes with cron auth or the worker-route delegate', () => {
    const protectedRoots = [
      path.join(root, 'app/api/cron'),
      path.join(root, 'app/api/internal'),
    ];
    const files = protectedRoots.flatMap((dir) => routeFiles(dir));
    files.push(path.join(root, 'app/api/events/process/route.ts'));
    files.push(path.join(root, 'app/api/health/route.ts'));

    const offenders = files.filter((file) => {
      const text = fs.readFileSync(file, 'utf8');
      return !text.includes('validateCronRequest') &&
        !text.includes('processEventWorkerRoute') &&
        !text.includes('eventWorkerHealthRoute');
    }).map((file) => path.relative(root, file));

    expect(offenders).toEqual([]);
  });

  it('fails closed for missing/default CRON_SECRET', () => {
    const cronAuth = fs.readFileSync(path.join(root, 'lib/middleware/cronAuth.ts'), 'utf8');
    const middleware = fs.readFileSync(path.join(root, 'middleware.ts'), 'utf8');

    expect(cronAuth).toContain("secret === 'super_secret_cron_token_123'");
    expect(middleware).toContain('secret === "super_secret_cron_token_123"');
  });
});
