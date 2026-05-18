import { GoogleGenAI } from '@google/genai';
import { createClient } from '@/lib/supabase/server';

export async function generateMentorRecovery(autopsyId: string, currentScore: number, potentialScore: number, incorrectQs: any[]) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const supabase = await createClient();

  // 1. Generate Topper Mentor Quote (Pro model for reasoning)
  const mentorPrompt = `
    You are an elite top-100 ranker mentor for NEET/JEE.
    The student just scored ${currentScore}, but their potential without silly/rushed mistakes was ${potentialScore}.
    Here is a summary of their mistakes:
    ${JSON.stringify(incorrectQs.slice(0, 10))}

    Give them a brutal but highly encouraging 2-sentence roast/mentor quote.
    Example: "You fought Physics bravely, but Chemistry time leakage cost you 20 marks in Biology. Lock in your Nernst equation formulas and you'll jump 50 marks."
    Do NOT use markdown. Just the raw quote string.
  `;

  const mentorRes = await ai.models.generateContent({
    model: 'gemini-2.5-pro',
    contents: mentorPrompt,
  });

  const mentorQuote = (mentorRes.text || '').trim();

  // Update autopsy record with the insight
  await (await supabase).from('mock_autopsies').update({
    mentor_insight: mentorQuote
  }).eq('id', autopsyId);

  // 2. Recovery Plan Algorithm (Sort by highest ROI)
  // Group by chapter
  const chapterLosses: Record<string, { marksLost: number, count: number, chapter: string, subject: string }> = {};
  incorrectQs.forEach(q => {
    if (!chapterLosses[q.chapter]) {
      chapterLosses[q.chapter] = { marksLost: 0, count: 0, chapter: q.chapter, subject: q.subject };
    }
    chapterLosses[q.chapter].marksLost += q.marksLost;
    chapterLosses[q.chapter].count += 1;
  });

  // Sort chapters by marks lost descending
  const sortedChapters = Object.values(chapterLosses).sort((a, b) => b.marksLost - a.marksLost);

  // Create a 3-Day Sprint Recovery Plan
  const top3 = sortedChapters.slice(0, 3);
  const totalRecoverable = top3.reduce((sum, c) => sum + c.marksLost, 0);
  
  const sprintTasks = top3.map((c, i) => ({
    day: i + 1,
    subject: c.subject,
    chapter: c.chapter,
    marksGain: c.marksLost,
    action: `Deep dive revision and 50 practice questions on ${c.chapter} to recover ${c.marksLost} marks.`
  }));

  const { data: planData } = await (await supabase).from('recovery_plans').insert({
    autopsy_id: autopsyId,
    title: '3-Day High-ROI Sprint',
    expected_marks_gain: totalRecoverable,
    estimated_minutes: 360, // 2 hours per day
    tasks: sprintTasks,
  }).select().single();

  return { mentorQuote, plan: planData };
}
