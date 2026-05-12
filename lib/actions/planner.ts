'use server';

import { createClient } from '@/lib/supabase/server';
import { generateDailyPlan } from '@/lib/ai/agents/planner';

export async function getPlanForDate(date: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];
  return generateDailyPlan(user.id, date);
}

export async function toggleTask(taskId: string) {
  const supabase = await createClient();
  const { data: task } = await supabase.from('study_tasks').select('is_completed').eq('id', taskId).single();
  if (!task) return;

  await supabase.from('study_tasks').update({
    is_completed: !task.is_completed,
    completed_at: !task.is_completed ? new Date().toISOString() : null,
  }).eq('id', taskId);
}
