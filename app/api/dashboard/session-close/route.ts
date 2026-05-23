import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { conceptName, subject, sessionDurationMinutes } = await req.json();

    // Gather data for personalised closing
    const [profileRes, masteryRes, mistakesRes, streakRes] = await Promise.all([
      supabase.from('profiles').select('full_name, exam_date, streak_days').eq('id', user.id).single(),
      supabase.from('concepts').select('mastery').eq('user_id', user.id).eq('name', conceptName).maybeSingle(),
      supabase.from('mistakes').select('chapter, category').eq('user_id', user.id).eq('chapter', conceptName).limit(2),
      supabase.from('profiles').select('streak_days').eq('id', user.id).single()
    ]);

    const profile = profileRes.data;
    const mastery = masteryRes.data?.mastery || 'developing';
    const pastMistakes = mistakesRes.data || [];
    const newStreak = (streakRes.data?.streak_days || 0) + 1;

    // Update streak
    await supabase.from('profiles').update({ streak_days: newStreak }).eq('id', user.id);

    const daysToExam = profile?.exam_date
      ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
      : null;

    const prompt = `Generate a SHORT (3-4 sentences max), personalized session closing message for a student.

Context:
- Just completed: ${conceptName} (${subject})
- Session duration: ${sessionDurationMinutes} minutes
- Current mastery of this topic: ${mastery}
- Past mistakes in this area: ${pastMistakes.map(m => m.category).join(', ') || 'none'}
- Days to exam: ${daysToExam || 'not set'}
- Streak after this session: ${newStreak} days

Rules:
1. Reference the SPECIFIC topic they just studied
2. Note one specific strength OR one specific gap from the session
3. Preview what tomorrow should focus on (next logical step)
4. End on momentum, not generic motivation
5. Keep it under 60 words total
6. Tone: like a senior who knows them well — direct, warm, specific

Return JSON: { "message": "closing message here" }`;

    const result = await generateJSON<{ message: string }>(
      'flash',
      'You are a personalized study coach. Return valid JSON only.',
      prompt
    );

    const message = result?.message || `Good session on ${conceptName}. Your mastery level has been updated in ATLAS. Tomorrow we'll push further — keep the streak going.`;

    // Log this session
    await supabase.from('study_sessions').insert({
      user_id: user.id,
      duration_minutes: sessionDurationMinutes || 0,
      started_at: new Date(Date.now() - (sessionDurationMinutes || 0) * 60000).toISOString(),
      ended_at: new Date().toISOString()
    });

    return NextResponse.json({ message, newStreak, daysToExam });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
