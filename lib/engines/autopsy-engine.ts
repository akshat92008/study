import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { AutopsyPaperSchema, AutopsyQuestionSchema } from './autopsy-schemas';
import { generateMentorRecovery } from './mentor-engine';
import { updateConceptState } from './cognition-graph';
import { createCardFromMistake } from './revision-engine';
import { logger } from '@/lib/utils/logger';

type AutopsyFileData =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

type AutopsyQuestion = z.infer<typeof AutopsyQuestionSchema>;
type ProcessedQuestion = AutopsyQuestion & { marksLost: number };

// Helper: Exponential Backoff for Multimodal Gemini Calls
async function robustMultimodalExtraction(contents: any[], retries = 3) {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  let attempt = 0;
  let delay = 1000;

  while (attempt < retries) {
    try {
      const res = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents,
        config: { 
          responseMimeType: 'application/json',
          temperature: 0.2, // Low temp for analytical accuracy
        },
      });

      const rawText = (res.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);
      return AutopsyPaperSchema.parse(parsed); // Strict Zod Validation

    } catch (err: any) {
      attempt++;
      logger.warn(`Autopsy Extraction Failed (Attempt ${attempt}/${retries})`, { error: err.message });
      if (attempt >= retries) throw new Error('AI failed to process the document format reliably.');
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('Unreachable');
}

export async function processMockAutopsy(
  userId: string, 
  fileData: AutopsyFileData, 
  testName: string, 
  examType: string = 'NEET',
  customScoring?: { correctMarks: number; negativeMarks: number }
) {
  const examConfig = getExamConfig(examType);
  const correctMarks = customScoring?.correctMarks ?? examConfig.correctMarks;
  const negativeMarks = customScoring?.negativeMarks ?? examConfig.negativeMarks;
  
  const supabase = await createClient();
  const subjectList = examConfig.subjects.join(', ');

  // 1. Production-Grade OCR & Analysis Prompt
  const masterPrompt = `
    You are an elite ${examType} grading and diagnostic engine. 
    Process the provided mock test submission. It may be a clean PDF, a low-quality scan, an OMR sheet, or contain handwritten scratchpad notes.
    
    CRITICAL OCR RULES:
    - Overcome visual noise. If an OMR bubble is slightly outside the lines but intended, count it.
    - If a question is entirely illegible, skip it but note it in "overallPaperQuality".
    
    ANALYSIS RULES:
    - Map every readable question to a subject: [${subjectList}] and its specific chapter.
    - Status MUST be "Correct", "Incorrect", or "Unattempted".
    - For EVERY "Incorrect" question, assign a STRICT mistakeCategory from: [conceptual, calculation, silly, time_pressure, misread, incomplete_knowledge, overconfidence, anxiety, recall_failure].
    - Provide a brief "reasoning" for WHY you chose that category based on their scratchpad work or the distractor option they chose.
    - Assign an "ocrConfidence" score (0-100) indicating how clearly you could read the student's answer.
    
    Output strictly adhering to the JSON schema requested. Do not include extra commentary outside the JSON.
  `;

  const contents = fileData.kind === 'text' 
    ? [{ role: 'user', parts: [{ text: masterPrompt + '\n\nData:\n' + fileData.text }] }]
    : [{ role: 'user', parts: [{ inlineData: { mimeType: fileData.mimeType, data: fileData.data } }, { text: masterPrompt }] }];

  // Execute Robust Single-Pass Extraction
  const { questions } = await robustMultimodalExtraction(contents);

  // 2. Score Calculation & ROI Engine
  let totalCorrect = 0, totalIncorrect = 0, totalUnattempted = 0;
  let recoverableMarks = 0;

  const processedQuestions: ProcessedQuestion[] = questions.map((q: AutopsyQuestion) => {
    let marksLost = 0;
    
    if (q.status === 'Correct') totalCorrect++;
    else if (q.status === 'Incorrect') {
      totalIncorrect++;
      marksLost = correctMarks + Math.abs(negativeMarks);
    } else {
      totalUnattempted++;
      marksLost = correctMarks;
    }

    // Recoverable Engine: High ROI errors
    if (q.status === 'Incorrect' && q.mistakeCategory && ['silly', 'misread', 'time_pressure', 'recall_failure'].includes(q.mistakeCategory)) {
      recoverableMarks += marksLost;
    }

    return { ...q, marksLost };
  });

  const currentScore = (totalCorrect * correctMarks) - (totalIncorrect * Math.abs(negativeMarks));
  const potentialScore = currentScore + recoverableMarks;

  // 3. Database Transactions
  const { data: autopsyData, error: autopsyErr } = await supabase.from('mock_autopsies').insert({
    user_id: userId,
    test_name: testName,
    current_score: currentScore,
    potential_score: potentialScore,
    recoverable_marks: recoverableMarks,
    total_questions: processedQuestions.length,
    exam_type: examType,
    ocr_raw_text: fileData.kind === 'text' ? fileData.text : '[Multimodal Image/PDF]',
    confidence_level: 'High'
  }).select().single();

  if (autopsyErr || !autopsyData) throw new Error('Failed to persist autopsy record.');

  const qRows = processedQuestions.map((q: ProcessedQuestion) => ({
    autopsy_id: autopsyData.id,
    question_number: q.questionNumber,
    subject: q.subject,
    chapter: q.chapter,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    status: q.status,
    correct_answer: q.correctAnswer,
    student_answer: q.studentAnswer,
    mistake_category: q.mistakeCategory,
    marks_lost: q.marksLost,
    suggested_fix: q.reasoning // Mapped reasoning to suggested_fix for DB
  }));

  // Batch insert in chunks to prevent payload size limits on massive tests
  for (let i = 0; i < qRows.length; i += 50) {
    await supabase.from('autopsy_questions').insert(qRows.slice(i, i + 50));
  }

  // 3.5 Sync Mistakes to ATLAS and MEMORY
  for (const q of processedQuestions.filter((q: ProcessedQuestion) => q.status === 'Incorrect')) {
    const { data: concept } = await supabase
      .from('concepts')
      .select('id')
      .eq('user_id', userId)
      .ilike('chapter', `%${q.chapter}%`)
      .limit(1)
      .single();
    
    if (concept) {
      await updateConceptState(concept.id, false, 0);
    }

    await createCardFromMistake(
      userId,
      concept ? concept.id : null,
      q.subject,
      q.chapter,
      `Question ${q.questionNumber}`,
      q.correctAnswer || 'Unknown',
      q.reasoning || 'No reasoning provided.'
    );
  }

  // 4. Generate the Recovery Plan
  const incorrectQs = processedQuestions.filter((q: ProcessedQuestion) => q.status === 'Incorrect');
  const { mentorQuote, plan } = await generateMentorRecovery(autopsyData.id, currentScore, potentialScore, incorrectQs, examType);

  // 5. Aggregate Analytics for Dashboard
  const categoryMap: Record<string, number> = {};
  const chapterMap: Record<string, number> = {};

  incorrectQs.forEach(q => {
    if (q.mistakeCategory) {
      categoryMap[q.mistakeCategory] = (categoryMap[q.mistakeCategory] || 0) + 1;
    }
    if (q.chapter) {
      chapterMap[q.chapter] = (chapterMap[q.chapter] || 0) + q.marksLost;
    }
  });

  const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  const chapterLoss = Object.entries(chapterMap)
    .map(([chapter, marksLost]) => ({ chapter, marksLost }))
    .sort((a, b) => b.marksLost - a.marksLost)
    .slice(0, 10); // Top 10 chapters

  logger.info(`Autopsy Complete`, { userId, testName, currentScore, potentialScore });

  return { 
    autopsyId: autopsyData.id, 
    currentScore, 
    potentialScore, 
    recoverableMarks, 
    mentorQuote, 
    plan, 
    examType,
    categoryBreakdown,
    chapterLoss
  };
}
