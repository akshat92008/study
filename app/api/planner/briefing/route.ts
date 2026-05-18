import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectEmotionalState, getAdaptiveConfig } from '@/lib/engines/pulse-engine';
import { getDueCards } from '@/lib/engines/revision-engine';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // 1. Check PULSE state
    const { state: mood, confidence } = await detectEmotionalState(user.id);
    const pulseConfig = getAdaptiveConfig(mood);

    // 2. Get existing tasks for today
    const { data: existingTasks } = await supabase
      .from('study_tasks')
      .select('*')
      .eq('user_id', user.id)
      .gte('scheduled_date', `${today}T00:00:00`)
      .lte('scheduled_date', `${today}T23:59:59`)
      .order('priority', { ascending: true });

    // 3. Get due revision cards count
    const dueCards = await getDueCards(user.id, 50);

    // 4. Get profile for exam countdown
    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type, target_year, streak_days')
      .eq('id', user.id)
      .single();

    // Calculate days to exam (approximate)
    const targetYear = profile?.target_year || new Date().getFullYear() + 1;
    const examDate = new Date(`${targetYear}-05-01`); // approximate NEET/JEE date
    const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    // 5. Get weak concepts (for focus recommendations)
    const { data: weakConcepts } = await supabase
      .from('concepts')
      .select('subject, chapter, mastery, forgetting_probability')
      .eq('user_id', user.id)
      .in('mastery', ['exposed', 'developing'])
      .order('forgetting_probability', { ascending: false })
      .limit(5);

    // 6. Build the briefing
    const completedCount = (existingTasks || []).filter((t: any) => t.is_completed).length;
    const totalCount = (existingTasks || []).length;

    const briefing = {
      date: today,
      mood: { state: mood, confidence, config: pulseConfig },
      daysRemaining,
      streak: profile?.streak_days || 0,
      examType: profile?.exam_type || 'NEET',

      tasks: existingTasks || [],
      progress: { completed: completedCount, total: totalCount },

      revision: {
        dueCount: dueCards.length,
        message: dueCards.length > 0
          ? `${dueCards.length} cards are about to be forgotten. Review them now.`
          : 'All caught up on revision! 🎉',
      },

      focusAreas: (weakConcepts || []).map((c: any) => ({
        subject: c.subject,
        chapter: c.chapter,
        urgency: c.forgetting_probability > 0.7 ? 'critical' : 'moderate',
      })),

      pulseMessage: pulseConfig.uiMessage,
    };

    return NextResponse.json(briefing);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
