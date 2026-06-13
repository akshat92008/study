import type { SupabaseClient } from '@supabase/supabase-js';
import type { GoalContextGoal } from '@/lib/services/goal-context.service';
import { CognitionError } from '@/lib/errors/cognition-errors';

const ACTIVE_GOAL_SELECT =
  'id, user_id, title, subject, domain, exam_type, preset_id, target_level, description, target_date, progress, status, primary_chat_session_id, last_active_at, metadata, created_at, updated_at';

export type ActiveGoalResolution = {
  goalId: string | null;
  goal: GoalContextGoal | null;
  source: 'profile' | 'fallback_active_goal' | 'none';
};

async function loadOwnedGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<GoalContextGoal | null> {
  const { data, error } = await supabase
    .from('learning_goals')
    .select(ACTIVE_GOAL_SELECT)
    .eq('id', goalId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new CognitionError('GOAL_ACCESS_DENIED', 'Unable to verify the selected learning goal.');
  return (data as GoalContextGoal | null) ?? null;
}

export async function resolveActiveGoalForUser(
  supabase: SupabaseClient,
  userId: string,
  preferredGoalId?: string | null
): Promise<ActiveGoalResolution> {
  if (!userId) throw new CognitionError('AUTH_REQUIRED', 'Authentication is required.');

  if (preferredGoalId) {
    const preferred = await loadOwnedGoal(supabase, userId, preferredGoalId);
    if (!preferred) throw new CognitionError('GOAL_NOT_FOUND', 'The selected learning goal was not found.');
    const { error } = await supabase
      .from('profiles')
      .update({ active_goal_id: preferred.id, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (error) throw new CognitionError('DATABASE_CONSTRAINT_FAILED', 'Unable to save the active learning goal.');
    return { goalId: preferred.id, goal: preferred, source: 'profile' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('active_goal_id')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw new CognitionError('DATABASE_CONSTRAINT_FAILED', 'Unable to load the active learning goal.');

  if (profile?.active_goal_id) {
    const profileGoal = await loadOwnedGoal(supabase, userId, profile.active_goal_id);
    if (profileGoal) return { goalId: profileGoal.id, goal: profileGoal, source: 'profile' };
  }

  const { data: fallback, error: fallbackError } = await supabase
    .from('learning_goals')
    .select(ACTIVE_GOAL_SELECT)
    .eq('user_id', userId)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (fallbackError) throw new CognitionError('DATABASE_CONSTRAINT_FAILED', 'Unable to resolve an active learning goal.');
  if (!fallback) return { goalId: null, goal: null, source: 'none' };

  const { error: persistError } = await supabase
    .from('profiles')
    .update({ active_goal_id: fallback.id, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (persistError) throw new CognitionError('DATABASE_CONSTRAINT_FAILED', 'Unable to persist the active learning goal.');

  return {
    goalId: fallback.id,
    goal: fallback as GoalContextGoal,
    source: 'fallback_active_goal',
  };
}
