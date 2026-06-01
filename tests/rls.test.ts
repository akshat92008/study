import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');

function readMigrations(): string {
  return fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n\n');
}

describe('Row Level Security migration invariants', () => {
  const sql = readMigrations();

  it('uses profiles.id, not profiles.user_id, in profile RLS policies', () => {
    expect(sql).not.toMatch(/on\s+public?\.?profiles[\s\S]{0,180}auth\.uid\(\)\s*=\s*user_id/i);
    expect(sql).toMatch(/on\s+public?\.?profiles[\s\S]{0,220}auth\.uid\(\)\s*=\s*id/i);
  });

  it('enables RLS for user-owned MVP tables', () => {
    for (const table of [
      'profiles',
      'learning_goals',
      'concepts',
      'mastery_events',
      'study_tasks',
      'study_sessions',
      'revision_cards',
      'mock_autopsies',
      'autopsy_questions',
      'autopsy_jobs',
      'mistakes',
      'session_cards',
      'daily_microtasks',
      'daily_plans',
      'ai_usage_daily',
      'ai_usage_events',
    ]) {
      expect(sql).toMatch(new RegExp(`alter table public\\.${table}|alter table ${table}`, 'i'));
      expect(sql).toMatch(new RegExp(`${table}[\\s\\S]{0,120}enable row level security`, 'i'));
    }
  });

  it('hardens client-callable security-definer RPCs against cross-user calls', () => {
    for (const functionName of [
      'complete_study_session',
      'ingest_mock_autopsy',
      'ingest_autopsy_document',
      'complete_daily_session_card',
      'invalidate_session_card',
    ]) {
      const matches = Array.from(sql.matchAll(new RegExp(`create or replace function public\\.${functionName}[\\s\\S]*?\\$\\$ language plpgsql`, 'gi')));
      const finalDefinition = matches.at(-1)?.[0] ?? '';
      expect(finalDefinition).toMatch(/auth\.uid\(\) is null or auth\.uid\(\) <> p_user_id|current_setting\('request\.jwt\.claim\.role', true\) <> 'service_role'/i);
    }
  });

  it('does not expose backend-only queue and budget RPCs to authenticated clients', () => {
    for (const functionName of ['create_event_with_consumers', 'acquire_event_leases', 'reserve_ai_budget', 'commit_ai_usage', 'release_ai_budget']) {
      expect(sql).toMatch(new RegExp(`revoke execute on function public\\.${functionName}[\\s\\S]*from public, authenticated`, 'i'));
      expect(sql).toMatch(new RegExp(`grant execute on function public\\.${functionName}[\\s\\S]*to service_role`, 'i'));
    }
  });

  it('requires verified high-confidence AUTOPSY evidence before learner-state consumers can mutate', () => {
    expect(sql).toContain("evidence_status in ('verified_mistake', 'needs_review', 'ignored_or_unverified', 'corrected_by_user')");
    expect(sql).toContain("evidence_status in ('verified_mistake', 'verified_correct', 'needs_review', 'pending_review', 'ignored', 'corrected_by_user', 'ignored_or_unverified')");
    expect(sql).toContain("'status', 'verified_mistake'");
    expect(sql).toContain("'needs_review', false");
    expect(sql).toContain("'extraction_confidence'");
  });
});
