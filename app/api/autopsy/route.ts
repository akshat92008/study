import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Get latest autopsy
    const { data: autopsy, error: autopsyErr } = await supabase
      .from('mock_autopsies')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (autopsyErr) throw autopsyErr;
    if (!autopsy) {
      return NextResponse.json({ result: null });
    }

    // 2. Get recovery plan for this autopsy
    const { data: plan } = await supabase
      .from('recovery_plans')
      .select('*')
      .eq('autopsy_id', autopsy.id)
      .maybeSingle();

    // 3. Get questions for this autopsy
    const { data: questions } = await supabase
      .from('autopsy_questions')
      .select('*')
      .eq('autopsy_id', autopsy.id);

    const incorrectQs = (questions || []).filter((q: any) => q.status === 'Incorrect');

    // 4. Calculate category breakdown and chapter losses
    const categoryMap: Record<string, number> = {};
    const chapterMap: Record<string, number> = {};

    incorrectQs.forEach(q => {
      if (q.mistake_category) categoryMap[q.mistake_category] = (categoryMap[q.mistake_category] || 0) + 1;
      if (q.chapter) chapterMap[q.chapter] = (chapterMap[q.chapter] || 0) + (q.marks_lost || 0);
    });

    const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    const chapterLoss = Object.entries(chapterMap)
      .map(([chapter, marksLost]) => ({ chapter, marksLost }))
      .sort((a, b) => b.marksLost - a.marksLost)
      .slice(0, 10);

    const result = {
      autopsyId: autopsy.id,
      currentScore: autopsy.current_score,
      potentialScore: autopsy.potential_score,
      recoverableMarks: autopsy.recoverable_marks,
      mentorQuote: autopsy.mentor_quote || autopsy.mentor_insight,
      plan: plan,
      examType: autopsy.exam_type,
      categoryBreakdown,
      chapterLoss
    };

    return NextResponse.json({ result });
  } catch (error: any) {
    console.error('Autopsy Fetch API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
