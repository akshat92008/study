import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const closingSchema = z.object({
  closing: z.string(),
});

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { taskId, subject, chapter } = body;
    if (!taskId || !subject || !chapter) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    // 2. Fetch in PARALLEL (Promise.all)
    const [taskRes, conceptsRes, tutorSessionsRes, profileRes] = await Promise.all([
      // a. The task from study_tasks
      supabase
        .from('study_tasks')
        .select('title, estimated_minutes')
        .eq('id', taskId)
        .eq('user_id', user.id)
        .maybeSingle(),
      // b. Latest mastery for the chapter from concepts
      supabase
        .from('concepts')
        .select('name, mastery, times_correct, times_incorrect')
        .eq('user_id', user.id)
        .eq('chapter', chapter)
        .order('updated_at', { ascending: false })
        .limit(3),
      // c. Any recent tutor_sessions in the last 2 hours
      supabase
        .from('tutor_sessions')
        .select('summary, understanding_gained')
        .eq('user_id', user.id)
        .gte('started_at', twoHoursAgo)
        .order('started_at', { ascending: false })
        .limit(1),
      // d. Profile details
      supabase
        .from('profiles')
        .select('streak_days, exam_type, exam_date')
        .eq('id', user.id)
        .maybeSingle(),
    ]);

    const task = taskRes.data;
    const concepts = conceptsRes.data || [];
    const tutorSession = tutorSessionsRes.data?.[0];
    const profile = profileRes.data;

    // 3. Calculate days_to_exam
    let daysToExam = 0;
    if (profile?.exam_date) {
      const examDate = new Date(profile.exam_date);
      const diffTime = examDate.getTime() - Date.now();
      daysToExam = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // 4. Build prompt and invoke generateJSON
    const system = 'You are MIND, the closing intelligence of Cognition OS. You write precise, personal, motivating session closings.';
    
    const conceptsInfo = concepts.length > 0
      ? concepts.map(c => `- Concept: "${c.name}", Mastery: ${c.mastery}, Correct: ${c.times_correct}, Incorrect: ${c.times_incorrect}`).join('\n')
      : 'No concept mastery recorded for this chapter yet.';

    const tutorSessionInfo = tutorSession
      ? `Recent Session Summary: "${tutorSession.summary || 'None'}", Understanding rating: ${tutorSession.understanding_gained || 0}/5`
      : 'No recent tutor session summarized in the last 2 hours.';

    const prompt = `
Generate a motivating closing statement for the student.

CONTEXT:
- Student Streak: ${profile?.streak_days || 0} days
- Exam Target: ${profile?.exam_type || 'General Study'}
- Days to Exam: ${daysToExam} days
- Subject: ${subject}
- Chapter: ${chapter}
- Focus Task: "${task?.title || 'Daily study session'}" (${task?.estimated_minutes || 45} mins commitment)

CONCEPTS/MASTERY CURRENT STATE:
${conceptsInfo}

${tutorSessionInfo}

INSTRUCTIONS:
1. Write 2-3 sentences max.
2. Reference the specific chapter ("${chapter}").
3. If the recent tutor session summary mentions a specific gap, mention it to help close the gap.
4. End with tomorrow's preview or next steps.
5. Tone: Warm, direct, motivating, and highly personalized.

Return JSON matching:
{
  "closing": string
}
`;

    const result = await generateJSON<{ closing: string }>(
      'flash',
      system,
      prompt,
      closingSchema
    );

    return NextResponse.json({ closing: result.closing });
  } catch (error: any) {
    logger.error('Error generating personalized session close message, using default fallback', error);
    // 5. Handle errors gracefully — return fallback message
    return NextResponse.json({
      closing: 'Good session. Rest well. Same chapter tomorrow to close the gap.',
    });
  }
}
