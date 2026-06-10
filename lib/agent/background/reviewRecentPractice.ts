import type { SupabaseClient } from '@supabase/supabase-js';
import { runHermesTurn } from '@/lib/agent/runtime';

export async function reviewRecentPractice(input: {
  supabase: SupabaseClient;
  userId: string;
  goalId?: string | null;
}) {
  const { data } = await input.supabase
    .from('practice_attempts')
    .select('id, is_correct, created_at, practice_item_id')
    .eq('user_id', input.userId)
    .order('created_at', { ascending: false })
    .limit(20);
  return runHermesTurn({
    userId: input.userId,
    channel: 'practice',
    goalId: input.goalId ?? undefined,
    payload: { practiceSetId: `background:${new Date().toISOString().slice(0, 10)}`, items: data ?? [], metrics: {} },
  }, {
    supabase: input.supabase,
    idempotencyKey: `background-practice:${input.userId}:${new Date().toISOString().slice(0, 10)}`,
    maxToolCalls: 25,
  });
}

