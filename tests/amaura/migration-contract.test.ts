import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migration = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260606120000_amaura_agentic_runtime.sql'),
  'utf8'
);
const vercelConfig = fs.readFileSync(path.join(root, 'vercel.json'), 'utf8');
const adminDashboardRoute = fs.readFileSync(
  path.join(root, 'app/api/admin/dashboard/route.ts'),
  'utf8'
);

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

    expect(replacementBody).toContain('amaura_goal_decomposer');
    expect(replacementBody).toContain('amaura_plan_adapter');
    expect(replacementBody).toContain('amaura_progress_evaluator');
    expect(replacementBody).toContain('amaura_next_action');
    expect(replacementBody).toContain('amaura_practice_agent');
    expect(replacementBody).toContain('amaura_session_agent');
    expect(replacementBody).toContain('amaura_autopsy_cascade');
    expect(replacementBody).toContain('amaura_forgetting_agent');
    expect(replacementBody).toContain('amaura_stagnation_agent');
    expect(replacementBody).toContain('amaura_pattern_memory');
    expect(replacementBody).toContain('create or replace function public.acquire_event_leases_for_user');
    expect(replacementBody).not.toContain('hermes_worker');
  });

  it('adds agentic columns to canonical goals, tasks, and observations tables', () => {
    expect(migration).toContain('add column if not exists agentic_status');
    expect(migration).toContain('add column if not exists progress_percent');
    expect(migration).toContain('add column if not exists risk_level');
    expect(migration).toContain('add column if not exists current_state');
    expect(migration).toContain('add column if not exists source_agent');
    expect(migration).toContain('add column if not exists source_event_id');
    expect(migration).toContain('add column if not exists dedup_key');
    expect(migration).toContain('create unique index if not exists daily_microtasks_user_dedup_unique');
    expect(migration).toContain('add column if not exists observation_type');
    expect(migration).toContain('create unique index if not exists learning_evidence_user_dedup_unique');
  });

  it('keeps admin safe consumers sourced from the canonical Amaura matrix', () => {
    expect(adminDashboardRoute).toContain('SAFE_BOUNDED_CONSUMERS');
    expect(adminDashboardRoute).not.toContain("const safeConsumers = [\n    'amaura_practice_agent'");
  });

  it('keeps Vercel Hobby scheduling to daily synthesis only', () => {
    const config = JSON.parse(vercelConfig) as { crons?: Array<{ path: string; schedule: string }> };

    expect(config.crons).toEqual([
      { path: '/api/cron/daily-synthesis', schedule: '0 6 * * *' },
      { path: '/api/cron/daily-background-review', schedule: '0 3 * * *' },
    ]);
  });
});
