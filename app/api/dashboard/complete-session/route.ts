// app/api/dashboard/complete-session/route.ts
// Marks session complete. Streak increments once per calendar day — idempotent.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { LearningStateEngine } from '@/lib/engines/learning-state-engine';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { taskId, subject, chapter, durationMinutes } = body;

    // 1. Mark task complete if provided (with IDOR protection)
    if (taskId) {
      await supabase
        .from('study_tasks')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id);
    }

    // 2. Fetch profile for streak logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days, last_session_date')
      .eq('id', user.id)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastSessionDate = profile?.last_session_date
      ? String(profile.last_session_date).split('T')[0]
      : null;

    let newStreak = profile?.streak_days || 0;
    let streakChanged = false;

    // Only increment streak once per calendar day
    if (lastSessionDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split('T')[0];

      if (!lastSessionDate) {
        newStreak = 1; // First ever session
      } else if (lastSessionDate === yesterdayStr) {
        newStreak = newStreak + 1; // Consecutive day
      } else {
        newStreak = 1; // Streak broken — reset
      }
      streakChanged = true;
    }

    // 3. Update profile
    const updatePayload: Record<string, any> = {
      last_active_at: new Date().toISOString(),
    };
    if (streakChanged) {
      updatePayload.streak_days = newStreak;
      updatePayload.last_session_date = today;
    }
    await supabase.from('profiles').update(updatePayload).eq('id', user.id);

    // 4. Log study session for PULSE signals
    await supabase.from('study_sessions').insert({
      user_id: user.id,
      started_at: new Date(Date.now() - (durationMinutes || 25) * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      duration_minutes: durationMinutes || 25,
      summary: subject && chapter
        ? `Studied ${chapter} (${subject})`
        : 'Daily session completed',
    });

    // 5. Fire telemetry event — non-blocking, never crashes the response
    LearningStateEngine.ingestEvent({
      userId: user.id,
      type: 'TASK_COMPLETED',
      data: {
        taskId: taskId || `session-${Date.now()}`,
        subject: subject || 'General',
        chapter: chapter || 'Session',
        durationMinutes: durationMinutes || 25,
      },
    }).catch(err => logger.warn('Telemetry ingest failed', { err: err.message }));

    return NextResponse.json({
      success: true,
      streakDays: newStreak,
      streakChanged,
    });
  } catch (error: any) {
    logger.error('complete-session error', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
