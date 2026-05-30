import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

import { getDueCards } from '@/lib/engines/revision-engine';
import { generateMorningBriefing } from '@/lib/ai/agents/planner';
import { logger, safeError } from '@/lib/utils/logger';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // 2. Fetch Profile Context
    const { data: profile } = await supabase
      .from('profiles')
      .select('exam_type, target_date, streak_days, emotional_state')
      .eq('id', user.id)
      .single();

    const mood = profile?.emotional_state || 'neutral';
    const confidence = 0.8;
    const moodConfig = { uiMessage: 'Stay focused on your mission.' };

    const examDate = profile?.target_date ? new Date(profile.target_date) : new Date(`${new Date().getFullYear() + 1}-05-01T00:00:00Z`); 
    const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    // 3. Parallel Fetching for Briefing Stats
    const [existingTasksRes, dueCards, weakConceptsRes, morningGreeting] = await Promise.all([
      supabase.from('study_tasks')
        .select('*')
        .eq('user_id', user.id)
        .eq('scheduled_date', today)
        .order('priority', { ascending: true }),
      getDueCards(user.id, 50),
      supabase.from('concepts')
        .select('subject, chapter, mastery, forgetting_probability')
        .eq('user_id', user.id)
        .in('mastery', ['exposed', 'developing'])
        .order('forgetting_probability', { ascending: false })
        .limit(5),
      // Generate the AI narrative greeting!
      generateMorningBriefing(user.id).catch(e => {
        logger.error('Failed to generate morning briefing narrative', e);
        return 'Ready for your daily mission. Study hard today!';
      })
    ]);

    const existingTasks = existingTasksRes.data || [];
    const completedCount = existingTasks.filter(t => t.is_completed).length;
    const totalCount = existingTasks.length;

    const briefing = {
      date: today,
      mood: { state: mood, confidence, config: moodConfig },
      daysRemaining,
      streak: profile?.streak_days || 0,
      examType: profile?.exam_type || 'General Study',
      tasks: existingTasks,
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
      missionMessage: moodConfig.uiMessage,
      greetingText: morningGreeting, // Pass to UI
    };

    return NextResponse.json(briefing);

  } catch (error: any) {
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
