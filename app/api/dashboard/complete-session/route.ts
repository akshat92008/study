import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { taskId } = await req.json();
    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    // 1. Mark the study task as completed
    const { error: taskError } = await supabase
      .from('study_tasks')
      .update({
        is_completed: true,
        completed_at: new Date().toISOString(),
      })
      .eq('id', taskId)
      .eq('user_id', user.id);

    if (taskError) {
      logger.error('Failed to complete study task', taskError);
      return NextResponse.json({ error: 'Failed to complete study task' }, { status: 500 });
    }

    // 2. Fetch profile, increment streak_days
    const { data: profile, error: profileFetchError } = await supabase
      .from('profiles')
      .select('streak_days')
      .eq('id', user.id)
      .single();

    if (profileFetchError) {
      logger.error('Failed to fetch user profile', profileFetchError);
      return NextResponse.json({ error: 'Failed to fetch user profile' }, { status: 500 });
    }

    const newStreak = (profile?.streak_days || 0) + 1;

    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        streak_days: newStreak,
        last_active_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    if (profileUpdateError) {
      logger.error('Failed to update user streak', profileUpdateError);
      return NextResponse.json({ error: 'Failed to update user streak' }, { status: 500 });
    }

    logger.info(`Daily session completed. Task: ${taskId}. Streak updated: ${newStreak}`);

    return NextResponse.json({
      success: true,
      streakDays: newStreak,
    });
  } catch (error: any) {
    logger.error('Error in complete-session endpoint', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
