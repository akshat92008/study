import { createClient } from '@/lib/supabase/server';
import AutopsyPageClient from '@/components/autopsy/AutopsyPageClient';

export default async function AutopsyPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: autopsy } = await supabase
    .from('mock_autopsies')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: questions } = autopsy
    ? await supabase.from('autopsy_questions').select('*').eq('autopsy_id', autopsy.id)
    : { data: [] };

  const incorrectQs = (questions || []).filter((q: any) => q.status === 'Incorrect');
  const categoryMap: Record<string, number> = {};
  const chapterMap: Record<string, number> = {};
  incorrectQs.forEach((q: any) => {
    if (q.mistake_category) categoryMap[q.mistake_category] = (categoryMap[q.mistake_category] || 0) + 1;
    if (q.chapter) chapterMap[q.chapter] = (chapterMap[q.chapter] || 0) + (q.marks_lost || 0);
  });

  const result = autopsy ? {
    autopsyId: autopsy.id,
    currentScore: autopsy.current_score,
    potentialScore: autopsy.potential_score,
    recoverableMarks: autopsy.recoverable_marks,
    mentorQuote: autopsy.mentor_quote || autopsy.mentor_insight,
    plan: null,
    examType: autopsy.exam_type,
    categoryBreakdown: Object.entries(categoryMap).map(([name, value]) => ({ name, value })),
    chapterLoss: Object.entries(chapterMap)
      .map(([chapter, marksLost]) => ({ chapter, marksLost }))
      .sort((a, b) => b.marksLost - a.marksLost)
      .slice(0, 10),
  } : null;

  return <AutopsyPageClient result={result} />;
}
