'use server';

import { createClient } from '@/lib/supabase/server';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { logger } from '@/lib/utils/logger';

export async function getPlanForDate(date: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];
    
    const { data: tasks } = await supabase
      .from('study_tasks')
      .select('*')
      .eq('user_id', user.id)
      .eq('scheduled_date', date)
      .order('priority', { ascending: true });
      
    return tasks || [];
  } catch (error) {
    logger.error('Error fetching plan for date', error);
    return [];
  }
}

export async function toggleTask(taskId: string) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Secure fetching: ensure task belongs to user
    const { data: task } = await supabase
      .from('study_tasks')
      .select('is_completed')
      .eq('id', taskId)
      .eq('user_id', user.id) // IDOR prevention
      .single();
      
    if (!task) return;

    await supabase.from('study_tasks').update({
      is_completed: !task.is_completed,
      completed_at: !task.is_completed ? new Date().toISOString() : null,
    }).eq('id', taskId).eq('user_id', user.id);
    
  } catch (error) {
    logger.error('Error toggling task', error);
  }
}
