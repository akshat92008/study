/**
 * Skill Provider - retrieve skills from database.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentSkill } from './skillTypes';

export async function loadSkillsForGoal(
  supabase: SupabaseClient,
  userId: string,
  goalId: string
): Promise<AgentSkill[]> {
  // Query goal skills + user's skills + global skills, then combine
  const [{ data: goalSkills }, { data: userSkills }, { data: globalSkills }] = await Promise.all([
    supabase.from('agent_skills').select('*').eq('status', 'active').eq('goal_id', goalId).order('success_count', { ascending: false }),
    supabase.from('agent_skills').select('*').eq('status', 'active').eq('user_id', userId).order('success_count', { ascending: false }).limit(5),
    supabase.from('agent_skills').select('*').eq('status', 'active').eq('scope', 'global').order('success_count', { ascending: false }).limit(5),
  ]);

  const allSkills = [...(goalSkills ?? []), ...(userSkills ?? []), ...(globalSkills ?? [])];
  // Dedupe by id
  const seen = new Set<string>();
  const deduped = allSkills.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  return deduped as unknown as AgentSkill[];
}

export async function loadSkillsForConcept(
  supabase: SupabaseClient,
  userId: string,
  conceptId: string
): Promise<AgentSkill[]> {
  const [{ data: conceptSkills }, { data: userSkills }, { data: globalSkills }] = await Promise.all([
    supabase.from('agent_skills').select('*').eq('status', 'active').eq('concept_id', conceptId).order('success_count', { ascending: false }),
    supabase.from('agent_skills').select('*').eq('status', 'active').eq('user_id', userId).order('success_count', { ascending: false }).limit(5),
    supabase.from('agent_skills').select('*').eq('status', 'active').eq('scope', 'global').order('success_count', { ascending: false }).limit(5),
  ]);

  const allSkills = [...(conceptSkills ?? []), ...(userSkills ?? []), ...(globalSkills ?? [])];
  const seen = new Set<string>();
  const deduped = allSkills.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
  return deduped as unknown as AgentSkill[];
}

export async function loadSkillsForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentSkill[]> {
  const { data, error } = await supabase
    .from('agent_skills')
    .select('*')
    .eq('status', 'active')
    .eq('user_id', userId)
    .order('success_count', { ascending: false })
    .limit(10);

  if (error) return [];
  return (data as unknown as AgentSkill[] | null) ?? [];
}

export async function loadGlobalSkills(
  supabase: SupabaseClient,
  limit: number = 20
): Promise<AgentSkill[]> {
  const { data, error } = await supabase
    .from('agent_skills')
    .select('*')
    .eq('status', 'active')
    .eq('scope', 'global')
    .order('success_count', { ascending: false })
    .limit(limit);

  if (error) return [];
  return (data as unknown as AgentSkill[] | null) ?? [];
}

export async function createSkill(
  supabase: SupabaseClient,
  skill: Omit<AgentSkill, 'id' | 'created_at' | 'updated_at'>
): Promise<AgentSkill | null> {
  const { data, error } = await supabase
    .from('agent_skills')
    .insert({
      user_id: skill.user_id,
      goal_id: skill.goal_id,
      concept_id: skill.concept_id,
      scope: skill.scope,
      name: skill.name,
      description: skill.description ?? null,
      trigger: skill.trigger,
      procedure: skill.procedure,
      source_run_id: skill.source_run_id ?? null,
      source_event_id: skill.source_event_id ?? null,
      status: skill.status,
      success_count: 0,
      failure_count: 0,
    })
    .select('*')
    .single();

  if (error) return null;
  return data as unknown as AgentSkill;
}

export async function updateSkillUsage(
  supabase: SupabaseClient,
  skillId: string,
  outcome: 'success' | 'failure' | 'partial'
): Promise<void> {
  const inc = outcome === 'success'
    ? { success_count: 1 }
    : outcome === 'failure'
      ? { failure_count: 1 }
      : { success_count: 1, failure_count: 1 };

  await supabase
    .from('agent_skills')
    .update({
      ...inc,
      last_used_at: new Date().toISOString(),
    })
    .eq('id', skillId);
}

export async function disableSkill(
  supabase: SupabaseClient,
  skillId: string
): Promise<void> {
  await supabase
    .from('agent_skills')
    .update({ status: 'disabled' })
    .eq('id', skillId);
}