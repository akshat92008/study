import type { SupabaseClient } from '@supabase/supabase-js';

export async function readTrajectory(
  supabase: SupabaseClient,
  input: { userId: string; trajectoryId: string }
) {
  const [runRes, snapshotsRes] = await Promise.all([
    supabase.from('agent_runs').select('*').eq('id', input.trajectoryId).eq('user_id', input.userId).maybeSingle(),
    supabase.from('agent_state_snapshots').select('*').eq('run_id', input.trajectoryId).eq('user_id', input.userId).order('created_at', { ascending: false }).limit(5),
  ]);
  if (runRes.error) throw runRes.error;
  if (snapshotsRes.error) throw snapshotsRes.error;
  return {
    run: runRes.data ?? null,
    snapshots: snapshotsRes.data ?? [],
  };
}

