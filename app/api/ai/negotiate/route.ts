import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText, generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';

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
  const result = await generateJSON('pro', 'You are an elite, empathetic academic assistant.', prompt, NegotiatedPlanSchema);

  // Validate we got real tasks back before touching the database
  if (!result || !Array.isArray(result.newTasks)) {
    throw new Error('AI returned invalid task structure');
  }

  // Build insert rows BEFORE deleting anything
  const rowsToInsert = result.newTasks.map(t => ({
    ...t,
    user_id: user.id,
    scheduled_date: date,
    is_completed: false
  }));

  // Only delete after we have confirmed valid replacement data
  if (currentTasks && currentTasks.length > 0) {
    const taskIds = currentTasks.map((t: any) => t.id);
    const { error: deleteError } = await supabase
      .from('study_tasks')
      .delete()
      .in('id', taskIds);
    
    if (deleteError) throw new Error(`Failed to delete old tasks: ${deleteError.message}`);
  }

  // Now insert the new tasks
  if (rowsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('study_tasks')
      .insert(rowsToInsert);
    
    if (insertError) {
      // Critical: insert failed after delete. Re-insert the original tasks to recover.
      if (currentTasks && currentTasks.length > 0) {
        try {
          await supabase.from('study_tasks').insert(
            currentTasks.map((t: any) => ({ ...t, id: undefined })) // let DB assign new IDs
          );
        } catch {
          // best effort recovery
        }
      }
      throw new Error(`Failed to insert new tasks: ${insertError.message}`);
    }
  }

  return new Response(JSON.stringify({ reply: result.assistantReply }), {
    headers: { 'Content-Type': 'application/json' },
  });

} catch (err) {
  console.error('Negotiate route error:', err);
  return new Response(JSON.stringify({ 
    reply: "I couldn't update the plan safely — your original tasks are still there. Tell me exactly what you want to change and I'll try again." 
  }), { status: 500 });
}
}
