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
    You are an elite, deeply empathetic academic mentor for ${examType === 'CUSTOM' ? 'your field' : examType}.
    The student scored ${currentScore}. Their potential score without silly/rushed mistakes was ${potentialScore}.
    
    Their highest ROI weak points (unlocked potential) are:
    ${top3Chapters.map(c => `- ${c.subject}: ${c.chapter} (${c.marksLost} ${unit} lost)`).join('\n')}

    Generate a structured JSON response containing:
    1. "mentorQuote": A highly encouraging, magical 2-sentence mentor quote focusing on growth and potential. AVOID all shame or "roasting". Frame mistakes as "unlocked potential" and highlight their recoverable marks as guaranteed future gains. (e.g. "You left ${totalRecoverableFromTop3} ${unit} on the table, which is actually incredible news—it means your potential is already there. Let's reclaim those marks by focusing on Physics and Chemistry this week.")
    2. "tasks": A structured 7-day sprint plan focusing on these top chapters. Exactly 1 task per day.

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
