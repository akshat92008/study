import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const canonical = fs.readFileSync(
  path.join(root, 'supabase/migrations/20260601000100_private_beta_mvp_schema_canonicalization.sql'),
  'utf8'
);

describe('MVP RLS policy contract', () => {
  it('enables RLS and owner policies for user-owned MVP tables', () => {
    for (const table of [
      'learning_goals',
      'concepts',
      'revision_cards',
      'chat_sessions',
      'chat_messages',
      'mock_autopsies',
      'autopsy_questions',
      'autopsy_jobs',
      'session_cards',
      'learner_states',
      'ai_usage_daily',
      'ai_usage_events',
    ]) {
      expect(canonical).toContain(`alter table public.%I enable row level security`);
      expect(canonical).toContain(`users_all_own_%s`);
      expect(canonical).toContain(`auth.uid() = user_id`);
      expect(canonical).toContain(table);
    }
  });

  it('keeps operational queue tables service-role only through grants/RPC usage', () => {
    for (const table of ['event_queue', 'consumer_locks', 'event_attempts', 'event_dlq']) {
      expect(canonical).toContain(`create table if not exists public.${table}`);
    }
    expect(canonical).toContain('grant execute on function public.create_event_with_consumers');
    expect(canonical).toContain('to service_role');
    expect(canonical).toContain('revoke execute on function public.create_event_with_consumers');
  });
});
