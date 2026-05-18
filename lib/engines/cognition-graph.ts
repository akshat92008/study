import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';

// Get all concepts for a user, organized by subject
export async function getCognitionGraph(userId: string) {
  const supabase = await createClient();

  const { data: concepts } = await supabase
    .from('concepts')
    .select('*')
    .eq('user_id', userId)
    .order('subject', { ascending: true });

  const { data: links } = await supabase
    .from('concept_links')
    .select('*')
    .eq('user_id', userId);

  // Group concepts by subject and chapter
  const grouped: Record<string, Record<string, any[]>> = {};
  (concepts || []).forEach((c: any) => {
    if (!grouped[c.subject]) grouped[c.subject] = {};
    if (!grouped[c.subject][c.chapter]) grouped[c.subject][c.chapter] = [];
    grouped[c.subject][c.chapter].push(c);
  });

  // Calculate mastery stats
  const stats = {
    total: concepts?.length || 0,
    mastered: concepts?.filter((c: any) => c.mastery === 'mastered' || c.mastery === 'automated').length || 0,
    proficient: concepts?.filter((c: any) => c.mastery === 'proficient').length || 0,
    developing: concepts?.filter((c: any) => c.mastery === 'developing').length || 0,
    weak: concepts?.filter((c: any) => c.mastery === 'exposed' || c.mastery === 'not_started').length || 0,
    overallMastery: 0,
  };
  if (stats.total > 0) {
    const masteryValues: Record<string, number> = {
      not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
    };
    const sum = (concepts || []).reduce((acc: number, c: any) => acc + (masteryValues[c.mastery] || 0), 0);
    stats.overallMastery = Math.round(sum / stats.total);
  }

  return { concepts: concepts || [], links: links || [], grouped, stats };
}

// Initialize concepts for a subject (bulk seed from any exam's chapters)
export async function seedConceptsForSubject(userId: string, subject: string, chapters: string[]) {
  const supabase = await createClient();

  const conceptRows = chapters.map((chapter) => ({
    user_id: userId,
    name: chapter,
    subject,
    chapter,
    topic: '',
    mastery: 'not_started' as const,
    confidence: 'low' as const,
  }));

  const { data, error } = await supabase.from('concepts').insert(conceptRows).select();
  if (error) throw error;
  return data;
}

// Update concept mastery after a quiz/review
export async function updateConceptMastery(
  conceptId: string,
  correct: boolean,
  timeSpent: number
) {
  const supabase = await createClient();

  const { data: concept } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', conceptId)
    .single();

  if (!concept) return;

  const newReviewed = (concept.times_reviewed || 0) + 1;
  const newCorrect = (concept.times_correct || 0) + (correct ? 1 : 0);
  const newIncorrect = (concept.times_incorrect || 0) + (correct ? 0 : 1);
  const accuracy = newCorrect / newReviewed;

  // Calculate new mastery level
  let newMastery = concept.mastery;
  if (accuracy >= 0.95 && newReviewed >= 5) newMastery = 'automated';
  else if (accuracy >= 0.85 && newReviewed >= 4) newMastery = 'mastered';
  else if (accuracy >= 0.7 && newReviewed >= 3) newMastery = 'proficient';
  else if (accuracy >= 0.4 && newReviewed >= 2) newMastery = 'developing';
  else if (newReviewed >= 1) newMastery = 'exposed';

  // Calculate forgetting probability (simplified Ebbinghaus)
  const daysSinceReview = concept.last_reviewed_at
    ? (Date.now() - new Date(concept.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const retentionStrength = Math.min(1, accuracy * (newReviewed / 10));
  const forgettingProbability = Math.max(0, 1 - retentionStrength * Math.exp(-0.1 * daysSinceReview));

  await supabase.from('concepts').update({
    times_reviewed: newReviewed,
    times_correct: newCorrect,
    times_incorrect: newIncorrect,
    mastery: newMastery,
    confidence: accuracy >= 0.8 ? 'high' : accuracy >= 0.5 ? 'medium' : 'low',
    last_reviewed_at: new Date().toISOString(),
    retention_strength: retentionStrength,
    forgetting_probability: forgettingProbability,
    updated_at: new Date().toISOString(),
  }).eq('id', conceptId);
}

// AI analysis of cognition state
export async function analyzeCognitionState(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  const { concepts, stats } = await getCognitionGraph(userId);
  if (concepts.length === 0) return null;

  const weakConcepts = concepts
    .filter((c: any) => c.mastery === 'not_started' || c.mastery === 'exposed')
    .map((c: any) => `${c.subject}: ${c.chapter}`)
    .slice(0, 10);

  const prompt = `Analyze this student's knowledge state and provide strategic insights:

Exam: ${examType}
Overall Mastery: ${stats.overallMastery}%
Total Concepts: ${stats.total}
Mastered: ${stats.mastered}
Developing: ${stats.developing}
Weak/Not Started: ${stats.weak}

Weak areas: ${weakConcepts.join(', ')}

Respond as JSON:
{
  "summary": "2-3 sentence overall assessment",
  "topPriority": "single most important thing to focus on",
  "strengths": ["list of 2-3 strengths"],
  "criticalGaps": ["list of 2-3 critical gaps"],
  "recommendation": "specific actionable advice for today"
}`;

  return generateJSON('flash', `You are an expert ${examType} exam strategist.`, prompt);
}
