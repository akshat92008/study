import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';
import { RateLimiter } from '@/lib/services/rateLimiter';

// We ask the AI to return BOTH a conversational response and a new task list
const NegotiatedPlanSchema = z.object({
  assistantReply: z.string(),
  newTasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['study', 'revision', 'practice', 'mock_test', 'break', 'review']),
    subject: z.string().nullable(),
    chapter: z.string().nullable(),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    estimated_minutes: z.number(),
    scheduled_start_time: z.string().nullable()
  }))
});

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  // Rate limit: 30 per 1h
  const limiter = RateLimiter.getInstance();
  const allowed = await limiter.consume(`ai-negotiate-${user.id}`, 30, 60 * 60 * 1000);
  if (!allowed) return new Response(JSON.stringify({ error: 'Rate limit reached. Please wait a moment.' }), { status: 429, headers: { 'Content-Type': 'application/json' } });

  const { message, date } = await req.json();

  // 1. Fetch the CURRENT uncompleted tasks for today
  const { data: currentTasks } = await supabase
    .from('study_tasks')
    .select('*')
    .eq('user_id', user.id)
    .eq('scheduled_date', date)
    .eq('is_completed', false);

  const prompt = `
    You are the empathetic AI Chief of Staff in Cognition OS.
    The student has looked at their daily study plan and wants to change it.
    
    User Request: "${message}"
    
    Current Uncompleted Tasks:
    ${JSON.stringify(currentTasks?.map(t => ({ title: t.title, subject: t.subject, minutes: t.estimated_minutes })))}
    
    YOUR JOB:
    1. Acknowledge their feeling/request warmly and empathetically in 'assistantReply'.
    2. Adjust the task list to EXACTLY match their wishes. If they want less work, slash the tasks. If they want to change subjects, swap them. 
    3. Return the COMPLETE new list of uncompleted tasks in 'newTasks'.
  `;

  try {
    // We use generateJSON so it perfectly formats the new database rows
    const result = await generateJSON('pro', 'You are an elite, empathetic academic assistant.', prompt, NegotiatedPlanSchema);

    // 2. Delete the old uncompleted tasks
    if (currentTasks && currentTasks.length > 0) {
      const taskIds = currentTasks.map(t => t.id);
      await supabase.from('study_tasks').delete().in('id', taskIds);
    }

    // 3. Insert the newly negotiated tasks
    if (result.newTasks.length > 0) {
      const rowsToInsert = result.newTasks.map(t => ({
        ...t,
        user_id: user.id,
        scheduled_date: date,
        is_completed: false
      }));
      await supabase.from('study_tasks').insert(rowsToInsert);
    }

    // 4. Return the conversational reply to the UI
    return new Response(JSON.stringify({ reply: result.assistantReply }), {
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ reply: "I'm having trouble updating the plan right now. Let me know what you want to drop and I'll try again." }), { status: 500 });
  }
}
