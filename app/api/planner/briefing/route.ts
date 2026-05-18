import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { detectEmotionalState, getAdaptiveConfig } from '@/lib/engines/pulse-engine';
import { getDueCards } from '@/lib/engines/revision-engine';
import { logger, safeError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Enforce local timezone resolution using server time
    const today = new Date().toISOString().split('T')[0];

    // 1. Check PULSE state
    const { state: mood, confidence } = await detectEmotionalState(user.id);
    const pulseConfig = getAdaptiveConfig(mood);

    // 2. Fetch Profile Context
    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type, target_year, streak_days')
      .eq('id', user.id)
      .single();

    // Dynamically calculate actual days remaining based on target year
    const targetYear = profile?.target_year || new Date().getFullYear() + 1;
    // Exams usually occur in May (NEET/JEE pattern)
    const examDate = new Date(`${targetYear}-05-01T00:00:00Z`); 
    const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    // 3. Parallel Fetching for Briefing Stats
    const [existingTasksRes, dueCards, weakConceptsRes] = await Promise.all([
      supabase.from('study_tasks')
        .select('*')
        .eq('user_id', user.id)
        .gte('scheduled_date', `${today}T00:00:00Z`) // Explicit Bounds
        .lte('scheduled_date', `${today}T23:59:59Z`)
        .order('priority', { ascending: true }),
      getDueCards(user.id, 50),
      supabase.from('concepts')
        .select('subject, chapter, mastery, forgetting_probability')
        .eq('user_id', user.id)
        .in('mastery', ['exposed', 'developing'])
        .order('forgetting_probability', { ascending: false })
        .limit(5)
    ]);

    const existingTasks = existingTasksRes.data || [];
    const completedCount = existingTasks.filter(t => t.is_completed).length;
    const totalCount = existingTasks.length;

    const briefing = {
      date: today,
      mood: { state: mood, confidence, config: pulseConfig },
      daysRemaining,
      streak: profile?.streak_days || 0,
      examType: profile?.exam_type || 'NEET',

      tasks: existingTasks, // Note: Existing Tasks now include the 'notes' field containing the AI rationale
      progress: { completed: completedCount, total: totalCount },

      revision: {
        dueCount: dueCards.length,
        message: dueCards.length > 0
          ? `${dueCards.length} cards hit the forgetting threshold. Review required.`
          : 'Retention stable. No urgent reviews required.',
      },

      focusAreas: (weakConceptsRes.data || []).map((c: any) => ({
        subject: c.subject,
        chapter: c.chapter,
        urgency: c.forgetting_probability > 0.7 ? 'critical' : 'moderate',
      })),

      pulseMessage: pulseConfig.uiMessage,
    };

    return NextResponse.json(briefing);

  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
