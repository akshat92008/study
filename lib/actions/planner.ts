'use server';

import { createClient } from '@/lib/supabase/server';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

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

// Zod schemas for sprint generator
const SprintTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  type: z.enum(['study', 'revision', 'practice', 'mock_test', 'break', 'review']),
  subject: z.string().nullable(),
  chapter: z.string().nullable(),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  estimated_minutes: z.number(),
  scheduled_date: z.string(),
  scheduled_start_time: z.string().nullable(),
});

const SprintPlanSchema = z.object({
  tasks: z.array(SprintTaskSchema),
});

export async function generateSprintPlanAction(subjects: string[], targetDate: string, dailyHours: number) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // 1. Fetch concepts for subjects
    const { data: concepts } = await supabase
      .from('concepts')
      .select('subject, chapter, mastery')
      .eq('user_id', user.id)
      .in('subject', subjects);

    const todayStr = new Date().toISOString().split('T')[0];

    // 2. Generate daily schedule from today up to targetDate
    const prompt = `
      You are COMMAND, the elite operations director of Cognition OS.
      Generate a hyper-focused sprint study plan from today (${todayStr}) to the target deadline (${targetDate}) inclusive.
      
      ## CONSTRAINTS
      - Daily Study Cap: ${dailyHours} hours per day (around ${dailyHours * 60} minutes/day total).
      - Subjects: ${subjects.join(', ')}
      - Available Chapters to schedule:
        ${concepts && concepts.length > 0 ? concepts.map(c => `- ${c.subject} > ${c.chapter} (Mastery: ${c.mastery})`).join('\n') : 'None'}

      ## RULES
      - Distribute the topics systematically across the days.
      - Allocate study, revision, and break blocks.
      - Ensure study blocks are between 45 to 90 minutes.
      - Every day must contain a reasonable load matching ${dailyHours} hours.
      - Start scheduling from today (${todayStr}) up to ${targetDate}.
    `;

    const { generateJSON } = await import('@/lib/ai/gemini');
    const plan = await generateJSON('flash', 'Expert academic scheduler.', prompt, SprintPlanSchema);
    
    if (!plan || !plan.tasks || plan.tasks.length === 0) {
      throw new Error('Failed to generate study plan.');
    }

    // 3. Clear existing tasks in the sprint window
    await supabase
      .from('study_tasks')
      .delete()
      .eq('user_id', user.id)
      .gte('scheduled_date', todayStr)
      .lte('scheduled_date', targetDate);

    // 4. Insert tasks into Database
    const rows = plan.tasks.map(t => ({
      user_id: user.id,
      title: t.title,
      description: t.description || '',
      type: t.type || 'study',
      subject: t.subject || null,
      chapter: t.chapter || null,
      priority: t.priority || 'medium',
      estimated_minutes: t.estimated_minutes || 60,
      scheduled_date: t.scheduled_date,
      scheduled_start_time: t.scheduled_start_time || null,
      is_completed: false,
      notes: 'Generated during hyper-sprint planning.'
    }));

    const { data: inserted, error } = await supabase
      .from('study_tasks')
      .insert(rows)
      .select();

    if (error) {
      throw error;
    }

    // 5. Update study hours in profile
    await supabase
      .from('profiles')
      .update({ study_hours_per_day: dailyHours })
      .eq('id', user.id);

    return { success: true, tasks: inserted };
  } catch (error: any) {
    logger.error('Error generating sprint plan action', error);
    return { success: false, error: error.message };
  }
}
