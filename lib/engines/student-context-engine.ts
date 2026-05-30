import { createClient } from '@/lib/supabase/server';

export async function getStudentContext(userId: string, currentSubject: string, currentChapter: string) {
  const supabase = await createClient();

  const [profileRes, conceptsRes, mistakesRes, revisionRes, autopsyRes] = await Promise.all([
    supabase.from('profiles').select('exam_type, target_date, emotional_state').eq('id', userId).single(),
    supabase.from('concepts').select('subject, chapter, mastery, forgetting_probability').eq('user_id', userId).in('mastery', ['not_started', 'exposed', 'developing']).order('forgetting_probability', { ascending: false }).limit(5),
    supabase.from('mistakes').select('category, ai_analysis, marks_lost, subject, chapter').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    supabase.from('revision_cards').select('id').eq('user_id', userId).lte('due', new Date().toISOString()),
    supabase.from('mock_autopsies').select('current_score, potential_score').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle()
  ]);

  const profile = profileRes.data;
  const examType = profile?.exam_type || 'General Study';
  const examDate = profile?.target_date ? new Date(profile.target_date) : new Date(`${new Date().getFullYear()}-05-01T00:00:00Z`); 
  const daysRemaining = Math.max(0, Math.ceil((examDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

  // Filter mistakes to prioritize the current subject/chapter context, but keep global awareness
  const mistakes = mistakesRes.data || [];
  const localMistakes = mistakes.filter(m => m.subject === currentSubject && m.chapter === currentChapter);
  const globalMistakes = mistakes.filter(m => m.subject !== currentSubject || m.chapter !== currentChapter).slice(0, 3);

  return {
    exam: {
      type: examType,
      daysRemaining,
      targetScore: autopsyRes.data?.potential_score || 'Unset',
      currentScore: autopsyRes.data?.current_score || 'Unset',
    },
    psychology: {
      emotionalState: profile?.emotional_state || 'neutral',
    },
    weakAreas: conceptsRes.data || [],
    mistakeHistory: {
      local: localMistakes,
      global: globalMistakes,
    },
    revisionUrgency: revisionRes.data?.length || 0,
  };
}
