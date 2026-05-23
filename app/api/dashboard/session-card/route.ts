import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';

const SessionCardSchema = z.object({
  dayNumber: z.number(),
  streakDays: z.number(),
  focusTopic: z.string(),
  subject: z.string(),
  estimatedMinutes: z.number(),
  rationale: z.string(),
  daysToExam: z.number().nullable(),
  overduecards: z.number(),
  masteryPercent: z.number(),
  closingMessage: z.string().optional()
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

    // Gather all context in parallel
    const [
      profileRes, goalRes, weakConceptsRes, overdueCardsRes,
      recentMistakesRes, todayTasksRes, sessionCountRes
    ] = await Promise.all([
      supabase.from('profiles').select('full_name, exam_type, exam_date, streak_days').eq('id', user.id).single(),
      supabase.from('learning_goals').select('*').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
      supabase.from('concepts').select('name, subject, chapter, mastery').eq('user_id', user.id).in('mastery', ['not_started', 'exposed', 'developing']).order('mastery').limit(5),
      supabase.from('revision_cards').select('id', { count: 'exact', head: true }).eq('user_id', user.id).lte('next_review', new Date().toISOString()),
      supabase.from('mistakes').select('subject, chapter, category').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('study_tasks').select('title, subject, chapter, estimated_minutes').eq('user_id', user.id).eq('scheduled_date', today).eq('is_completed', false).limit(1),
      supabase.from('study_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
    ]);

    const profile = profileRes.data;
    const goal = goalRes.data;
    const weakConcepts = weakConceptsRes.data || [];
    const overdueCount = (overdueCardsRes.count || 0) as number;
    const recentMistakes = recentMistakesRes.data || [];
    const todayTask = todayTasksRes.data?.[0];
    const sessionCount = (sessionCountRes.count || 0) as number;

    // Compute mastery %
    const { count: totalConcepts } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: masteredConcepts } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('mastery', ['mastered', 'automated']);
    const masteryPercent = totalConcepts ? Math.round(((masteredConcepts || 0) / totalConcepts) * 100) : 0;

    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const streakDays = profile?.streak_days || 0;

    // If there's already a scheduled task for today, use it directly
    if (todayTask) {
      return NextResponse.json({
        dayNumber: sessionCount + 1,
        streakDays,
        focusTopic: todayTask.title,
        subject: todayTask.subject || 'General',
        estimatedMinutes: todayTask.estimated_minutes || 45,
        rationale: overdueCount > 0 ? `${overdueCount} overdue flashcards need review` : 'Top priority based on your mastery gaps',
        daysToExam,
        overdueCards: overdueCount,
        masteryPercent
      });
    }

    // Otherwise: AI-generate the best session card
    const cardPrompt = `You are the COMMAND engine of Cognition OS. Generate today's single study session card.

Student Context:
- Name: ${profile?.full_name || 'Student'}
- Exam: ${profile?.exam_type || goal?.title || 'General Study'}
- Days to exam: ${daysToExam || 'Not set'}
- Streak: ${streakDays} days
- Mastery: ${masteryPercent}%
- Overdue flashcards: ${overdueCount}
- Weak concepts: ${weakConcepts.map(c => `${c.name} (${c.mastery})`).join(', ') || 'None yet'}
- Recent mistakes: ${recentMistakes.map(m => `${m.chapter} (${m.category})`).join(', ') || 'None'}

RULE: If overdue flashcards > 5, the session MUST include a review block.
RULE: Focus on the weakest concept that isn't a prerequisite of something even weaker.
RULE: estimatedMinutes should be 25-60 minutes.

Return JSON only:
{
  "focusTopic": "specific chapter or concept name",
  "subject": "subject name",
  "estimatedMinutes": 45,
  "rationale": "one clear sentence explaining why this is today's priority"
}`;

    const cardData = await generateJSON<any>('flash', 'You are a study session planner. Return valid JSON only.', cardPrompt);

    return NextResponse.json({
      dayNumber: sessionCount + 1,
      streakDays,
      focusTopic: cardData?.focusTopic || (weakConcepts[0]?.name || 'Review Your Weakest Topic'),
      subject: cardData?.subject || weakConcepts[0]?.subject || 'General',
      estimatedMinutes: cardData?.estimatedMinutes || 45,
      rationale: cardData?.rationale || (overdueCount > 0 ? `${overdueCount} flashcards are overdue` : 'Focus on your weakest areas'),
      daysToExam,
      overdueCards: overdueCount,
      masteryPercent
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
