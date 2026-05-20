import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CommandPlanner } from '@/lib/engines/command-engine';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { date, commit } = body;

    if (!date) {
      return NextResponse.json({ error: 'Missing date parameter.' }, { status: 400 });
    }

    // 1. Fetch active goal to get preferred daily hours
    const { data: activeGoal } = await supabase
      .from('learning_goals')
      .select('daily_hours_available')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const dailyHours = activeGoal?.daily_hours_available || 8;

    const planner = new CommandPlanner();

    // 2. Compute candidate scores
    const candidates = await planner.computeScores(user.id, date);

    // 3. Pack daily schedule
    const packedTasks = planner.packDailySchedule(candidates, dailyHours);

    // 4. Optionally commit to the database
    if (commit) {
      // Clear existing tasks on this date (only keep manually completed tasks or delete all for full rebuild)
      await supabase
        .from('study_tasks')
        .delete()
        .eq('user_id', user.id)
        .eq('scheduled_date', date);

      if (packedTasks.length > 0) {
        const rows = packedTasks.map(t => ({
          user_id: user.id,
          title: t.title,
          description: t.description || '',
          type: t.type,
          subject: t.subject || null,
          chapter: t.chapter || null,
          priority: t.priority,
          estimated_minutes: t.estimated_minutes,
          scheduled_date: date,
          is_completed: false,
          notes: `Engineered by COMMAND v2: ${t.rationale}`,
          metadata: t.metadata || {}
        }));

        const { error: insertErr } = await supabase
          .from('study_tasks')
          .insert(rows);

        if (insertErr) {
          logger.error('Failed to commit packed schedule to DB', insertErr);
          throw new Error(`Failed to commit schedule: ${insertErr.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      candidates,
      schedule: packedTasks,
      committed: !!commit
    });

  } catch (error: any) {
    logger.error('Error in POST /api/planner/replan', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
