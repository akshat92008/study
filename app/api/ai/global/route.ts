import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { streamText } from '@/lib/ai/gemini';
import { getSocraticOrchestratorPrompt } from '@/lib/ai/prompts/mentor';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response('Unauthorized', { status: 401 });

    const { message, history, currentPath } = await req.json();
    const today = new Date().toISOString().split('T')[0];

    // Fetch rich context from Supabase (profile, today's tasks, recent mistakes, and recent event bus items)
    const [profileRes, tasksRes, mistakesRes, eventsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('study_tasks').select('id, is_completed').eq('user_id', user.id).eq('scheduled_date', today),
      supabase.from('mistake_records').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(5),
      supabase.from('student_events').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10)
    ]);

    const profile = profileRes.data || {};
    const tasks = tasksRes.data || [];
    const completedTasks = tasks.filter(t => t.is_completed).length;
    const totalTasks = tasks.length;
    const recentMistakes = mistakesRes.data || [];
    const events = eventsRes.data || [];

    const stats = {
      overallMastery: profile.overall_mastery || 0,
      mastered: 0,
      total: 0,
      weak: 0,
      cardsDue: 0
    };

    // Construct the rich Socratic system prompt
    const systemPrompt = getSocraticOrchestratorPrompt(
      profile,
      stats,
      recentMistakes,
      events,
      currentPath || '/',
      completedTasks,
      totalTasks
    );

    // Format chat history for context
    const historyText = (history || [])
      .slice(-10)
      .map((m: any) => `${m.role === 'user' ? 'Student' : 'Cognition OS'}: ${m.content}`)
      .join('\n');

    const fullUserPrompt = `${historyText}\nStudent: ${message}`;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Use the pro model (Gemini 2.5 Pro) for high-order Socratic dialog
          const generator = streamText('pro', systemPrompt, fullUserPrompt, 0.7);
          for await (const chunk of generator) {
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err: any) {
          logger.error('Error during global assistant stream', err);
          controller.enqueue(encoder.encode('\n\n[Cognition is briefly disconnected. Let me know if you want to retry.]'));
        }
        controller.close();
      },
    });

    return new Response(stream, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  } catch (error: any) {
    logger.error('Critical failure in global assistant route', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}

