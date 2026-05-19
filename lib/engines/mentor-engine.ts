import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { RecoveryPlanSchema } from './autopsy-schemas';
import { logger } from '@/lib/utils/logger';

export async function generateMentorRecovery(
  autopsyId: string,
  currentScore: number,
  potentialScore: number,
  incorrectQs: any[],
  examType: string
) {
  const supabase = await createClient();

  // Aggregate chapters to find highest ROI (Marks Lost)
  const chapterLosses: Record<string, { marksLost: number, chapter: string, subject: string }> = {};
  incorrectQs.forEach(q => {
    const chapterName = q.chapter || 'Unknown';
    if (!chapterLosses[chapterName]) {
      chapterLosses[chapterName] = { marksLost: 0, chapter: chapterName, subject: q.subject };
    }
    chapterLosses[chapterName].marksLost += q.marksLost || 0;
  });

  const top3Chapters = Object.values(chapterLosses)
    .sort((a, b) => b.marksLost - a.marksLost)
    .slice(0, 3);

  const totalRecoverableFromTop3 = top3Chapters.reduce((s, c) => s + c.marksLost, 0);

  const unit = examType === 'CUSTOM' ? '% points' : 'marks';
  const prompt = `
    You are an elite top performer mentor for ${examType === 'CUSTOM' ? 'your field' : examType}.
    The student scored ${currentScore}. Their potential score without silly/rushed mistakes was ${potentialScore}.
    
    Their highest ROI weak points are:
    ${top3Chapters.map(c => `- ${c.subject}: ${c.chapter} (${c.marksLost} ${unit} lost)`).join('\n')}

    Generate a structured JSON response containing:
    1. "mentorQuote": A brutal but highly encouraging 2-sentence roast/mentor quote. (e.g. "You fought Physics bravely, but Chemistry time leakage cost you. Lock in Thermodynamics and you'll jump 20 ${unit}.")
    2. "tasks": A 3-day sprint plan focusing ONLY on these top chapters. 1 task per day.

    Respond STRICTLY to the JSON schema.
  `;

  // Use the safe generateJSON wrapper (which includes retries & Zod parsing)
  const result = await generateJSON('pro', 'You are an elite academic mentor.', prompt, RecoveryPlanSchema);

  if (!result) {
    logger.error('Failed to generate mentor recovery plan', { autopsyId });
    throw new Error('Failed to generate recovery plan');
  }

  // Update autopsy record with the insight
  await supabase.from('mock_autopsies').update({
    mentor_insight: result.mentorQuote,
    mentor_quote: result.mentorQuote,
  }).eq('id', autopsyId);

  // Insert the structured recovery plan
  const { data: planData } = await supabase.from('recovery_plans').insert({
    autopsy_id: autopsyId,
    title: 'High-ROI Recovery Sprint',
    expected_marks_gain: totalRecoverableFromTop3,
    estimated_minutes: result.tasks.length * 60, // approx 1 hr per task
    tasks: result.tasks,
  }).select().single();

  return { mentorQuote: result.mentorQuote, plan: planData };
}
