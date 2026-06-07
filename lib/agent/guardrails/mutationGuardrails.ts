import type { SupabaseClient } from '@supabase/supabase-js';

export async function assertGoalOwned(
  supabase: SupabaseClient,
  input: { userId: string; goalId?: string | null }
) {
  if (!input.goalId) return;
  const { data, error } = await supabase
    .from('learning_goals')
    .select('id')
    .eq('id', input.goalId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Goal does not belong to user.');
}

export async function assertConceptOwned(
  supabase: SupabaseClient,
  input: { userId: string; conceptId: string }
) {
  const { data, error } = await supabase
    .from('concepts')
    .select('id')
    .eq('id', input.conceptId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Concept does not belong to user.');
}

export async function assertMaterialOwned(
  supabase: SupabaseClient,
  input: { userId: string; materialId: string }
) {
  const { data, error } = await supabase
    .from('study_materials')
    .select('id')
    .eq('id', input.materialId)
    .eq('user_id', input.userId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.id) throw new Error('Material does not belong to user.');
}

