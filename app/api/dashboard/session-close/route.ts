import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';
import { getEmbedding } from '@/lib/ai/gemini';

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
    const [taskRes, conceptsRes, tutorSessionsRes, profileRes, sessionStartRes] = await Promise.all([
      // a. The task from study_tasks
      supabase
        .from('study_tasks')
        .select('title, estimated_minutes, scheduled_date')
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
        .select('streak_days, exam_type, exam_date, emotional_state')
        .eq('id', user.id)
        .maybeSingle(),
      // e. Session start snapshot (for diffing)
      supabase
        .from('performance_snapshots')
        .select('accuracy, focus_score, retention_rate')
        .eq('user_id', user.id)
        .gte('date', new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString())
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const task = taskRes.data;
    const concepts = conceptsRes.data || [];
    const tutorSession = tutorSessionsRes.data?.[0];
    const profile = profileRes.data;
    const sessionStart = sessionStartRes.data;

    // 3. Calculate days_to_exam
    let daysToExam = 0;
    if (profile?.exam_date) {
      const examDate = new Date(profile.exam_date);
      const diffTime = examDate.getTime() - Date.now();
      daysToExam = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    }

    // 4. Calculate data deltas
    const sessionMinutes = task?.estimated_minutes || 45;
    const newlyMasteredCount = concepts.filter(c => ['mastered', 'automated'].includes(c.mastery)).length;
    const struggleCount = concepts.filter(c => ['not_started', 'exposed'].includes(c.mastery)).length;
    const struggleTopic = struggleCount > 0 ? concepts.find(c => ['not_started', 'exposed'].includes(c.mastery))?.name : null;
    const accuracy = sessionStart?.accuracy || 0;

    // 5. Fetch salient memories for context
    let salientMemoryString = 'None';
    try {
      const queryEmbedding = await getEmbedding(`${subject} ${chapter} ${task?.title || ''}`);
      const { data: memories } = await supabase.rpc('get_salient_memories', {
        p_user_id: user.id,
        p_query_embedding: queryEmbedding,
        p_pulse_state: profile?.emotional_state || 'neutral',
        p_limit: 1
      });

      if (memories && memories.length > 0) {
        salientMemoryString = memories[0].description;
      }
    } catch (err) {
      logger.error('Failed to fetch salient memories for session close', err);
    }

    // 6. Build prompt and invoke generateJSON
    const system = 'You are the closing intelligence of Cognition OS.';
    
    const prompt = `
The student just completed a ${sessionMinutes}-minute focus block on ${chapter}.

DATA DELTAS:
- Accuracy today: ${accuracy}%
- New Masteries: ${newlyMasteredCount}
- Struggle Points: ${struggleCount > 0 ? 'Yes, on ' + struggleTopic : 'None'}
- Past Memory: ${salientMemoryString}

Generate a 2-3 sentence closing statement.
RULES:
1. NEVER use generic praise ("Great job!", "Keep it up!").
2. NEVER use exclamation points unless they hit an all-time high metric.
3. Call out exactly what improved. Ground it in data.
4. If they struggled, validate the difficulty of the specific concept, don't pity them.
5. End with a precise look-ahead to tomorrow.

GOOD EXAMPLE: "You cleared 14 FSRS cards today and finally locked in the Carnot cycle efficiency formula that tripped you up last Tuesday. Your retention is stabilizing. Tomorrow, we map out Thermodynamics."
BAD EXAMPLE: "Amazing job today! You worked so hard on Thermodynamics. Keep up the great work and see you tomorrow!"

Output strictly JSON: { "closing": "..." }
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
