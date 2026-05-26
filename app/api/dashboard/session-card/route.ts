import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { z } from 'zod';

const INVALID_TOPIC_VALUES = new Set([
  'none', 'null', 'undefined', 'n/a', 'na', 'unknown', 
  'not set', 'no topic', 'general', ''
]);

function sanitizeTopic(value: string | null | undefined, fallback: string): string {
  if (!value) return fallback;
  if (INVALID_TOPIC_VALUES.has(value.toLowerCase().trim())) return fallback;
  return value.trim();
}

// FIX BUG 8: Schema and all return shapes now consistently use overdueCards (camelCase)
// Previously the Zod schema said 'overduecards' but the component declared 'overdueCards'
const SessionCardSchema = z.object({
  dayNumber: z.number(),
  streakDays: z.number(),
  focusTopic: z.string(),
  subject: z.string(),
  estimatedMinutes: z.number(),
  rationale: z.string(),
  daysToExam: z.number().nullable(),
  overdueCards: z.number(),   // ← was 'overduecards' — now matches component
  masteryPercent: z.number(),
  closingMessage: z.string().optional(),
});

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const today = new Date().toISOString().split('T')[0];

// Attempt to fetch precomputed session card from DB cache
const { data: cachedCard, error: cacheErr } = await supabase
  .from('session_cards')
  .select('*')
  .eq('user_id', user.id)
  .eq('date', today)
  .single();

if (cachedCard && !cacheErr) {
  return NextResponse.json(cachedCard);
}

    const [
      profileRes, goalRes, weakConceptsRes, overdueCardsRes,
      recentMistakesRes, todayTasksRes, sessionCountRes, studentModelRes
    ] = await Promise.all([
      supabase.from('profiles').select('full_name, exam_type, exam_date, streak_days').eq('id', user.id).single(),
      supabase.from('learning_goals').select('*').eq('user_id', user.id).eq('status', 'active').limit(1).maybeSingle(),
      supabase.from('concepts').select('name, subject, chapter, mastery').eq('user_id', user.id).in('mastery', ['not_started', 'exposed', 'developing']).order('mastery').limit(5),
      supabase.from('revision_cards').select('id', { count: 'exact', head: true }).eq('user_id', user.id).lte('next_review', new Date().toISOString()),
      supabase.from('mistakes').select('subject, chapter, category').eq('user_id', user.id).order('created_at', { ascending: false }).limit(3),
      supabase.from('study_tasks').select('title, subject, chapter, estimated_minutes').eq('user_id', user.id).eq('scheduled_date', today).eq('is_completed', false).limit(1),
      supabase.from('study_sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('student_models').select('fatigue_threshold_minutes, peak_productivity_hour').eq('user_id', user.id).maybeSingle()
    ]);

    const profile = profileRes.data;
    const goal = goalRes.data;
    const weakConcepts = weakConceptsRes.data || [];
    const overdueCount = (overdueCardsRes.count || 0) as number;
    const recentMistakes = recentMistakesRes.data || [];
    const todayTask = todayTasksRes.data?.[0];
    const sessionCount = (sessionCountRes.count || 0) as number;
    const studentModel: any = studentModelRes.data || {};

    const focusWindow = studentModel.fatigue_threshold_minutes || 45;
    const peakHour = studentModel.peak_productivity_hour || 10;
    const currentHour = new Date().getHours();
    const isPeakHour = Math.abs(currentHour - peakHour) <= 1;

    const { count: totalConcepts } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('user_id', user.id);
    const { count: masteredConcepts } = await supabase.from('concepts').select('*', { count: 'exact', head: true }).eq('user_id', user.id).in('mastery', ['mastered', 'automated']);
    const masteryPercent = totalConcepts ? Math.round(((masteredConcepts || 0) / totalConcepts) * 100) : 0;

    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const streakDays = profile?.streak_days || 0;

    // If there is already a scheduled task, use it directly
    if (todayTask) {
      let rationale = overdueCount > 0 ? `${overdueCount} overdue flashcards need review` : 'Top priority based on your mastery gaps';
      if (isPeakHour) rationale += ' • You are in your peak focus window.';

      const card = {
        dayNumber: sessionCount + 1,
        streakDays,
        focusTopic: todayTask.title,
        subject: todayTask.subject || 'General',
        estimatedMinutes: todayTask.estimated_minutes || focusWindow,
        rationale,
        daysToExam,
        overdueCards: overdueCount,   // ← consistent camelCase
        masteryPercent,
      };

      // Upsert the card into cache table for future requests
      await supabase.from('session_cards').upsert({
        user_id: user.id,
        date: today,
        ...card,
      });

      return NextResponse.json(card);
    }

    // AI-generate the best session card
    const cardPrompt = `You are the COMMAND engine of Cognition OS. Generate today's single study session card.

Student Context:
- Exam: ${profile?.exam_type || goal?.title || 'General Study'}
- Days to exam: ${daysToExam || 'Not set'}
- Streak: ${streakDays} days
- Mastery: ${masteryPercent}%
- Overdue flashcards: ${overdueCount}
- Weak concepts: ${weakConcepts.map(c => `${c.name} (${c.mastery})`).join(', ') || 'Fundamentals not yet mapped'}
- Recent mistakes: ${recentMistakes.map(m => `${m.chapter} (${m.category})`).join(', ') || 'None recorded yet'}
- Optimal Focus Window: ${focusWindow} minutes
- Peak Productivity Status: ${isPeakHour ? 'Active now' : 'Not active'}

STRICT RULES:
1. focusTopic MUST be a real, specific concept or chapter name. NEVER write "none", "null", "N/A", or "General".
2. If no weak concepts exist yet, use the first foundational topic for this exam type.
3. estimatedMinutes MUST be EXACTLY the Optimal Focus Window (${focusWindow} minutes).
4. subject must be the actual subject name (Physics, Chemistry, Biology, Mathematics, etc.)
5. rationale should mention if they are in their Peak Productivity window if it is 'Active now'.

Return ONLY valid JSON, no markdown:
{
  "focusTopic": "specific chapter or concept name",
  "subject": "subject name",
  "estimatedMinutes": ${focusWindow},
  "rationale": "one clear sentence explaining why this is today's priority"
}`;

    const cardData = await generateJSON<any>('flash', 'You are a study session planner. Return valid JSON only.', cardPrompt);

    const examType = profile?.exam_type || 'General Study';
    const defaultTopic = weakConcepts[0]?.name || `${examType} Fundamentals`;
    let fallbackRationale = overdueCount > 0 
        ? `${overdueCount} flashcards are overdue — review time is critical`
        : `Focus on your weakest area to build foundation`;
    if (isPeakHour) fallbackRationale += ' • You are in your peak focus window.';

    const card = {
      dayNumber: sessionCount + 1,
      streakDays,
      focusTopic: sanitizeTopic(cardData?.focusTopic, defaultTopic),
      subject: sanitizeTopic(cardData?.subject, weakConcepts[0]?.subject || examType),
      estimatedMinutes: cardData?.estimatedMinutes || focusWindow,
      rationale: cardData?.rationale || fallbackRationale,
      daysToExam,
      overdueCards: overdueCount,
      masteryPercent,
    };

    // Cache the generated card for subsequent loads
    await supabase.from('session_cards').upsert({
      user_id: user.id,
      date: today,
      ...card,
    });

    return NextResponse.json(card);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
