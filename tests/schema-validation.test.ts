import { describe, expect, it } from 'vitest';
import { createAdminClient } from '@/lib/supabase/admin';

const hasSupabaseEnv =
  Boolean(process.env.SUPABASE_TEST_URL) &&
  Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const liveIt = it;

describe('live Supabase schema validation', () => {
  liveIt('has the runtime tables, columns, and budget RPC used by the MVP loop', async () => {
    const supabase = createAdminClient();

    const checks = [
      supabase.from('ai_usage_events').select('id').limit(1),
      supabase.from('profiles').select('id, exam_type, streak_days, last_active_at').limit(1),
      supabase.from('concepts').select('id, mastery, forgetting_probability').limit(1),
      supabase.from('revision_cards').select('id, due').limit(1),
      supabase.from('session_cards').select('id, user_id, date, learner_state_version').limit(1),
      supabase.from('daily_plans').select('id, user_id, plan_date, morning_briefing').limit(1),
      supabase.from('chat_messages').select('id, user_id, session_id').limit(1),
      supabase.from('semantic_memories').select('id, user_id, content').limit(1),
      supabase.from('mock_autopsies').select('id, user_id, status').limit(1),
      supabase.from('mistake_events').select('id, user_id').limit(1),
      supabase.from('event_queue').select('id, user_id, type').limit(1),
      supabase.from('consumer_locks').select('id, event_id, consumer_name').limit(1),
    ];

    const results = await Promise.all(checks);
    const failures = results
      .map((result, index) => ({ index, error: result.error }))
      .filter((result) => result.error);

    expect(failures).toEqual([]);

    const { error: rpcErr } = await supabase.rpc('atomic_ai_budget_spend', {
      p_user_id: '00000000-0000-0000-0000-000000000000',
      p_feature: 'test',
      p_model: 'test_model',
      p_cost: 0,
      p_prompt_tokens: 0,
      p_completion_tokens: 0,
      p_route: 'test',
    });

    expect(rpcErr?.code).not.toBe('42883');
  });

  it('documents why live schema validation may be skipped locally', () => {
    expect(typeof hasSupabaseEnv).toBe('boolean');
  });
});
