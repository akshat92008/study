import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260606120000_amaura_agentic_runtime.sql'),
  'utf8'
);
const vercelConfig = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');

describe('Amaura agentic runtime migration contract', () => {
  it('adds native runtime tables with RLS and idempotency constraints', () => {
    expect(migration).toContain('create table if not exists public.amaura_notifications');
    expect(migration).toContain('create table if not exists public.amaura_pattern_memories');
    expect(migration).toContain('create table if not exists public.amaura_agent_runs');
    expect(migration).toContain('alter table public.amaura_notifications enable row level security');
    expect(migration).toContain('alter table public.amaura_pattern_memories enable row level security');
    expect(migration).toContain('alter table public.amaura_agent_runs enable row level security');
    expect(migration).toContain('create unique index if not exists amaura_notifications_user_dedup_unique');
    expect(migration).toContain('unique(user_id, agent_name, dedup_key)');
  });

  it('replaces Hermes routing with Amaura queue consumers and safe user leases', () => {
    const replacementBody = migration.slice(migration.indexOf('create or replace function public.create_event_with_consumers'));

    expect(replacementBody).toContain('amaura_practice_agent');
    expect(replacementBody).toContain('amaura_autopsy_cascade');
    expect(replacementBody).toContain('amaura_forgetting_agent');
    expect(replacementBody).toContain('amaura_stagnation_agent');
    expect(replacementBody).toContain('amaura_pattern_memory');
    expect(replacementBody).toContain('create or replace function public.acquire_event_leases_for_user');
    expect(replacementBody).not.toContain('hermes_worker');
  });

  it('keeps Vercel Hobby scheduling to daily synthesis only', () => {
    const config = JSON.parse(vercelConfig) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toEqual([
      { path: '/api/cron/daily-synthesis', schedule: '0 6 * * *' },
    ]);
  });
});
