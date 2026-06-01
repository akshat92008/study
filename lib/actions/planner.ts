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
  description: z.string().nullable().optional(),
  type: z.enum(['study', 'revision', 'practice', 'mock_test', 'break', 'review']),
  subject: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  priority: z.enum(['critical', 'high', 'medium', 'low']).nullable().optional(),
  estimated_minutes: z.number(),
  scheduled_date: z.string(),
  scheduled_start_time: z.string().nullable().optional(),
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

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // Cap planning period to max 7 days to keep AI generation extremely fast and focused.
    const target = new Date(targetDate);
    const timeDiff = target.getTime() - today.getTime();
    const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24));

    let finalEndDate = targetDate;
    let capMsg = "";
    if (diffDays > 7) {
      const capDate = new Date();
      capDate.setDate(today.getDate() + 7);
      finalEndDate = capDate.toISOString().split('T')[0];
      capMsg = ` (Note: The target exam date is ${diffDays} days away. We are only generating a 7-day focus sprint first from ${todayStr} to ${finalEndDate} to ensure highly active, near-term schedules.)`;
    }

    // 2. Generate daily schedule from today up to finalEndDate
    const prompt = `
      You are the closed-beta daily mission planner for Cognition OS.
      Generate a hyper-focused sprint study plan from today (${todayStr}) to the sprint deadline (${finalEndDate}) inclusive.${capMsg}
      
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
      - Start scheduling from today (${todayStr}) up to ${finalEndDate}.
    `;

    const { generateJSON } = await import('@/lib/ai/provider-client');
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
      .lte('scheduled_date', finalEndDate);

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
      .update({ daily_hours: dailyHours })
      .eq('id', user.id);

    return { success: true, tasks: inserted };
  } catch (error: any) {
    logger.error('Error generating sprint plan action', error);
    return { success: false, error: error.message };
  }
}
