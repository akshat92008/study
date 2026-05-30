// app/api/dashboard/complete-session/route.ts
// Marks session complete. Streak increments once per calendar day — idempotent.

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { EventDispatcher } from '@/lib/events/orchestrator';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { taskId, subject, chapter, durationMinutes } = body;

    // 1. Mark task complete if provided (with IDOR protection)
    if (taskId) {
      const { error: taskError } = await supabase
        .from('study_tasks')
        .update({ is_completed: true, completed_at: new Date().toISOString() })
        .eq('id', taskId)
        .eq('user_id', user.id);
      if (taskError) return NextResponse.json({ error: taskError.message }, { status: 500 });
    }

    // 2. Fetch profile for streak logic
    const { data: profile } = await supabase
      .from('profiles')
      .select('streak_days, last_active_at')
      .eq('id', user.id)
      .single();

    const today = new Date().toISOString().split('T')[0];
    const lastSessionDate = profile?.last_active_at
      ? String(profile.last_active_at).split('T')[0]
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
    }
    const { error: profileUpdateError } = await supabase.from('profiles').update(updatePayload).eq('id', user.id);
    if (profileUpdateError) return NextResponse.json({ error: profileUpdateError.message }, { status: 500 });

    // 4. Log completed study session for streaks, planning, and analytics.
    const { data: sessionRecord, error: sessionInsertError } = await supabase.from('study_sessions').insert({
      user_id: user.id,
      subject: subject || null,
      chapter: chapter || null,
      topic: chapter || null,
      concept_name: chapter || null,
      started_at: new Date(Date.now() - (durationMinutes || 25) * 60 * 1000).toISOString(),
      ended_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
      duration_minutes: durationMinutes || 25,
      understood: true,
      is_completed: true,
      notes: subject && chapter
        ? `Studied ${chapter} (${subject})`
        : 'Daily session completed',
    }).select('id').single();
    if (sessionInsertError || !sessionRecord) {
      return NextResponse.json({ error: sessionInsertError?.message || 'Failed to save study session' }, { status: 500 });
    }

    // 5. Enqueue the durable command completion event.
    await EventDispatcher.publish({
      user_id: user.id,
      type: 'COMMAND_SESSION_COMPLETED',
      data: {
        sessionId: sessionRecord.id,
        taskId: taskId || `session-${Date.now()}`,
        subject: subject || 'General',
        chapter: chapter || 'Session',
        durationMinutes: durationMinutes || 25,
        understood: true,
        understandingGained: true,
        isSessionComplete: true,
      },
      metadata: { source: 'complete_session' },
      idempotency_key: `complete_session:${sessionRecord.id}`,
    });

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
