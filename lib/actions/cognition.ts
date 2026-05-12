'use server';

import { createClient } from '@/lib/supabase/server';
import { getCognitionGraph, seedConceptsForSubject, analyzeCognitionState } from '@/lib/engines/cognition-graph';
import { getChapters } from '@/lib/utils/constants';

export async function getCognitionData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getCognitionGraph(user.id);
}

export async function initializeConcepts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Check if concepts already seeded
  const { count } = await supabase
    .from('concepts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count && count > 0) return { status: 'already_seeded' };

  // Get user's exam type and seed appropriate chapters
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', user.id).single();
  const examType = profile?.exam_type || 'NEET';
  const chapters = getChapters(examType);

  for (const [subject, chapterList] of Object.entries(chapters)) {
    await seedConceptsForSubject(user.id, subject, chapterList);
  }
  return { status: 'seeded' };
}

export async function getAIAnalysis() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return analyzeCognitionState(user.id);
}
