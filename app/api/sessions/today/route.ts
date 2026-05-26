import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

// Helper to calculate completion percent
function calculateCompletion(planned: number, actual: number): number {
  if (planned === 0) return 0;
  const pct = Math.round((actual / planned) * 100);
  return pct > 100 ? 100 : pct;
}

const SessionTodaySchema = z.object({
  completionPercent: z.number(),
  plannedMinutes: z.number(),
  actualMinutes: z.number(),
  sessionCount: z.number(),
  daysToExam: z.number().nullable(),
  tasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      completed: z.boolean(),
      priority: z.enum(['high', 'medium', 'low']),
    })
  ),
  sessions: z.array(
    z.object({
      id: z.string(),
      durationMinutes: z.number(),
      understood: z.boolean(),
      cardsCreated: z.number(),
    })
  ),
  timeStudiedToday: z.number(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // Fetch profile for exam date
    const { data: profile } = await supabase.from('profiles').select('exam_date').eq('id', user.id).single();
    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    // Planned tasks for today
    const { data: plannedTasks } = await supabase
      .from('study_tasks')
      .select('id, title, is_completed, priority, estimated_minutes')
      .eq('user_id', user.id)
      .eq('scheduled_date', today);

    const tasks = (plannedTasks || []).map((t: any) => ({
      id: t.id,
      title: t.title,
      completed: t.is_completed,
      priority: t.priority,
    }));

    const plannedMinutes = tasks.reduce((sum, t) => sum + (t.completed ? 0 : (t as any).estimated_minutes || 0), 0);

    // Completed sessions for today
    const { data: todaySessions } = await supabase
      .from('study_sessions')
      .select('id, duration_minutes, understood, cards_created')
      .eq('user_id', user.id)
      .eq('date', today);

    const sessions = (todaySessions || []).map((s: any) => ({
      id: s.id,
      durationMinutes: s.duration_minutes,
      understood: s.understood,
      cardsCreated: s.cards_created,
    }));

    const actualMinutes = sessions.reduce((sum, s) => sum + s.durationMinutes, 0);
    const timeStudiedToday = actualMinutes;

    const completionPercent = calculateCompletion(plannedMinutes, actualMinutes);

    // Count total sessions for streak count (optional, not used here)
    const { count: sessionCount } = await supabase.from('study_sessions').select('*', { count: 'exact', head: true }).eq('user_id', user.id);

    const response = {
      completionPercent,
      plannedMinutes,
      actualMinutes,
      sessionCount: Number(sessionCount) || 0,
      daysToExam,
      tasks,
      sessions,
      timeStudiedToday,
    };

    // Validate shape
    const parsed = SessionTodaySchema.safeParse(response);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid data shape', details: parsed.error.format() }, { status: 500 });
    }

    return NextResponse.json(parsed.data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
