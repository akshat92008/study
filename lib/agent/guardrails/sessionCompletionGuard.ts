import type { SupabaseClient } from '@supabase/supabase-js';

export async function verifySessionCompletion(
  supabase: SupabaseClient,
  input: { userId: string; sessionId?: string | null; goalId?: string | null }
) {
  if (input.sessionId) {
    const { data } = await supabase
      .from('study_sessions')
      .select('id, is_completed, completed_at')
      .eq('id', input.sessionId)
      .eq('user_id', input.userId)
      .maybeSingle();
    if (data?.id && (data.is_completed || data.completed_at)) return true;
  }

  const today = new Date().toISOString().slice(0, 10);
  let query = supabase
    .from('session_cards')
    .select('id, is_completed, "isCompleted", completed_at, "completedAt"')
    .eq('user_id', input.userId)
    .eq('date', today);
  if (input.goalId) query = query.eq('goal_id', input.goalId);
  const { data } = await query.limit(1).maybeSingle();
  return Boolean(data?.is_completed || data?.isCompleted || data?.completed_at || data?.completedAt);
}

