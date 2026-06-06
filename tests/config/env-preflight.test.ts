import { describe, expect, it } from 'vitest';
import { execSync } from 'child_process';
import path from 'path';

describe('Environment Preflight Hardening', () => {
  const scriptPath = path.join(process.cwd(), 'scripts', 'env-preflight.ts');

  const runPreflight = (envOverrides: Record<string, string>) => {
    try {
      const result = execSync(`npx tsx ${scriptPath}`, {
        env: { ...process.env, ...envOverrides, SKIP_ENV_VALIDATION: '0' },
        encoding: 'utf8',
        stdio: 'pipe',
      });
      return { ok: true, output: result };
    } catch (err: any) {
      return { ok: false, output: err.stderr || err.stdout };
    }
  };

  it('rejects missing critical envs', () => {
    const res = runPreflight({ NEXT_PUBLIC_SUPABASE_URL: '' });
    expect(res.ok).toBe(false);
    expect(res.output).toContain('Missing required env var: NEXT_PUBLIC_SUPABASE_URL');
  });

  it('rejects weak cron secrets', () => {
    const res = runPreflight({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      INTERNAL_CRON_SECRET: 'changeme',
      ADMIN_EMAILS: 'admin@test.com',
      AI_DAILY_BUDGET_USD: '10',
      AI_MONTHLY_BUDGET_USD: '100',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(res.ok).toBe(false);
    expect(res.output).toContain('INTERNAL_CRON_SECRET uses a known weak value');
  });

  it('rejects missing admin config', () => {
    const res = runPreflight({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      INTERNAL_CRON_SECRET: 'strong-secret-value',
      ADMIN_EMAILS: '',
      ADMIN_USER_IDS: '',
      AI_DAILY_BUDGET_USD: '10',
      AI_MONTHLY_BUDGET_USD: '100',
      OPENAI_API_KEY: 'sk-test',
    });
    expect(res.ok).toBe(false);
    expect(res.output).toContain('Admin protection not configured');
  });

  it('never logs secrets', () => {
    const secret = 'super-secret-cron-key-12345';
    const res = runPreflight({
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test',
      SUPABASE_SERVICE_ROLE_KEY: 'test',
      INTERNAL_CRON_SECRET: secret,
      ADMIN_EMAILS: 'admin@test.com',
      AI_DAILY_BUDGET_USD: '10',
      AI_MONTHLY_BUDGET_USD: '100',
      OPENAI_API_KEY: 'sk-test',
    });
    // This could be true or false depending on other real env vars missing, but
    // we want to ensure the secret is not printed.
    expect(res.output).not.toContain(secret);
  });
});
