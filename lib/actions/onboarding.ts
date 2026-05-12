'use server';

import { createClient } from '@/lib/supabase/server';
import { getChapters } from '@/lib/utils/constants';
import { seedConceptsForSubject } from '@/lib/engines/cognition-graph';

export async function completeOnboarding(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const examType = formData.get('examType') as string || 'NEET';
  const targetYear = parseInt(formData.get('targetYear') as string) || 2026;
  const targetScore = parseInt(formData.get('targetScore') as string) || 650;
  const studyHours = parseInt(formData.get('studyHours') as string) || 8;

  // Update profile
  await supabase.from('profiles').update({
    exam_type: examType,
    target_year: targetYear,
    target_score: targetScore,
    study_hours_per_day: studyHours,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }).eq('id', user.id);

  // Seed concepts based on the chosen exam type
  const chapters = getChapters(examType);
  for (const [subject, chapterList] of Object.entries(chapters)) {
    await seedConceptsForSubject(user.id, subject, chapterList);
  }

  return { success: true };
}
