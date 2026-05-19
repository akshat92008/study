import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });

  const { message, history, currentPath } = await req.json();
  const today = new Date().toISOString().split('T')[0];

  // Fetch quick context so the AI knows what's happening right now
  const [profileRes, tasksRes] = await Promise.all([
    supabase.from('profiles').select('full_name, exam_type').eq('id', user.id).single(),
    supabase.from('study_tasks').select('title, is_completed').eq('user_id', user.id).eq('scheduled_date', today),
  ]);

  const tasks = tasksRes.data || [];
  const completed = tasks.filter(t => t.is_completed).length;

  const prompt = `
    You are Cognition, the persistent AI assistant inside an academic operating system.
    You exist as a floating window on the user's screen. 
    
    Current Context:
    - User: ${profileRes.data?.full_name || 'Student'}
    - Exam: ${profileRes.data?.exam_type || 'General'}
    - Current Page the user is looking at: ${currentPath}
    - Today's Progress: ${completed}/${tasks.length} tasks completed.
    
    If they ask to change their plan, tell them to go to the "Command Center" (Home tab) to use the Mission Copilot.
    Otherwise, act as their hyper-intelligent, encouraging guide. Keep responses concise, direct, and formatted cleanly.
  `;

  const historyText = (history || []).slice(-6).map((m: any) => `${m.role === 'user' ? 'Student' : 'Cognition'}: ${m.content}`).join('\n');
  const fullPrompt = `${prompt}\n\n## Chat History\n${historyText}\n\nStudent: ${message}`;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamText('flash', 'You are Cognition, an elite academic assistant.', fullPrompt, 0.7)) {
          controller.enqueue(encoder.encode(chunk));
        }
      } catch { controller.enqueue(encoder.encode('\n\n[Network interruption. Please try again.]')); }
      controller.close();
    },
  });

  return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
