import { createClient } from '@/lib/supabase/server';
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { AutopsyPaperSchema, AutopsyQuestionSchema } from './autopsy-schemas';
import { generateMentorRecovery } from './mentor-engine';
import { logger } from '@/lib/utils/logger';
import { generateJSON } from '@/lib/ai/gemini';
// EventDispatcher import removed; using direct calls

type AutopsyFileData =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

type AutopsyQuestion = z.infer<typeof AutopsyQuestionSchema>;
type ProcessedQuestion = AutopsyQuestion & { marksLost: number };

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * PASS 1: Fast data extraction using Gemini Flash
 */
async function fastExtractionPass(contents: any[], subjectList: string, retries = 3) {
  let attempt = 0;
  let delay = 1000;

  const extractionPrompt = `
    Extract all questions from this mock test submission. It may be a PDF, low-quality scan, OMR sheet, or handwritten.
    
    RULES:
    - Identify the question number.
    - Map to a subject: [${subjectList}] and its chapter.
    - Determine status: "Correct", "Incorrect", or "Unattempted".
    - Provide an "ocrConfidence" score (0-100).
    - Leave "mistakeCategory" and "reasoning" null for now.
    
    Output strictly as JSON matching the schema.
  `;

  const augmentedContents = [...contents];
  if (augmentedContents[0].parts.some((p: any) => p.text)) {
    const textPart = augmentedContents[0].parts.find((p: any) => p.text);
    textPart.text = extractionPrompt + '\n\nData:\n' + textPart.text;
  } else {
    augmentedContents[0].parts.push({ text: extractionPrompt });
  }

  while (attempt < retries) {
    try {
       const res = await ai.models.generateContent({
         model: 'gemini-2.0-flash',
         contents: augmentedContents,
         config: { 
           responseMimeType: 'application/json',
           temperature: 0.1, 
         },
       });

      const rawText = (res.text || '{}').replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(rawText);
      return AutopsyPaperSchema.parse(parsed); 

    } catch (err: any) {
      attempt++;
      logger.warn(`Pass 1 Extraction Failed (Attempt ${attempt}/${retries})`, { error: err.message });
      if (attempt >= retries) throw new Error('AI failed to extract the document format reliably.');
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error('Unreachable');
}

/**
 * PASS 2: Deep Diagnostic using Gemini Pro (Only for Incorrect questions)
 */
async function deepDiagnosticPass(incorrectQuestions: AutopsyQuestion[]): Promise<AutopsyQuestion[]> {
  if (incorrectQuestions.length === 0) return [];

  const diagnosticPrompt = `
    You are an elite educational psychologist and diagnostician. 
    Review the following list of incorrect questions.
    For EACH question, determine the strict root cause (mistakeCategory) from: 
    [conceptual, calculation, silly, time_pressure, misread, incomplete_knowledge, overconfidence, anxiety, recall_failure].
    
    Provide a 1-sentence "reasoning" explaining exactly WHY you chose this category. Be hyper-specific.
    
    Input data:
    ${JSON.stringify(incorrectQuestions, null, 2)}
    
    Respond ONLY with a JSON array of objects, each containing:
    { "questionNumber": number, "mistakeCategory": string, "reasoning": string }
  `;

  try {
    const diagnostics = await generateJSON<Array<{ questionNumber: number, mistakeCategory: any, reasoning: string }>>(
      'pro',
      'You are an elite educational psychologist and diagnostician.',
      diagnosticPrompt,
      undefined,
      0.3
    );

    // Merge diagnostics back
    return incorrectQuestions.map(q => {
      const diag = diagnostics.find(d => d.questionNumber === q.questionNumber);
      if (diag) {
        return { ...q, mistakeCategory: diag.mistakeCategory, reasoning: diag.reasoning };
      }
      return q;
    });

  } catch (err: any) {
    logger.warn('Pass 2 Diagnostic failed, falling back to basic extraction.', err);
    return incorrectQuestions; // fallback to un-categorized if Pro fails
  }
}

export async function processMockAutopsy(
  userId: string, 
  fileData: AutopsyFileData, 
  testName: string, 
  examType: string = 'General Study',
  customScoring?: { correctMarks: number; negativeMarks: number }
) {
  const examConfig = getExamConfig(examType);
  const correctMarks = customScoring?.correctMarks ?? examConfig.correctMarks;
  const negativeMarks = customScoring?.negativeMarks ?? examConfig.negativeMarks;
  
  const supabase = await createClient();
  
  const { getUserSyllabus } = await import('@/lib/engines/atlas-expansion');
  const userSyllabus = await getUserSyllabus(userId, examType);
  const subjectList = userSyllabus.subjects.join(', ');

  const contents = fileData.kind === 'text' 
    ? [{ role: 'user', parts: [{ text: fileData.text }] }]
    : [{ role: 'user', parts: [{ inlineData: { mimeType: fileData.mimeType, data: fileData.data } }] }];

  // 1. Two-Pass AI Extraction & Diagnostics
  const { questions: extractedQuestions } = await fastExtractionPass(contents, subjectList);
  
  const correctAndUnattempted = extractedQuestions.filter(q => q.status !== 'Incorrect');
  const incorrectRaw = extractedQuestions.filter(q => q.status === 'Incorrect');
  
  const diagnosedIncorrect = await deepDiagnosticPass(incorrectRaw);
  
  // Combine back
  const allQuestions = [...correctAndUnattempted, ...diagnosedIncorrect];

  // 2. Score Calculation
  let totalCorrect = 0, totalIncorrect = 0, totalUnattempted = 0;
  let recoverableMarks = 0;

  const processedQuestions: ProcessedQuestion[] = allQuestions.map((q: AutopsyQuestion) => {
    let marksLost = 0;
    if (q.status === 'Correct') totalCorrect++;
    else if (q.status === 'Incorrect') {
      totalIncorrect++;
      marksLost = correctMarks + Math.abs(negativeMarks);
    } else {
      totalUnattempted++;
      marksLost = correctMarks;
    }

    if (q.status === 'Incorrect' && q.mistakeCategory && ['silly', 'misread', 'time_pressure', 'recall_failure'].includes(q.mistakeCategory)) {
      recoverableMarks += marksLost;
    }

    return { ...q, marksLost };
  });

  const currentScore = (totalCorrect * correctMarks) - (totalIncorrect * Math.abs(negativeMarks));
  const potentialScore = currentScore + recoverableMarks;

  // 3. Database Persistence
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
    suggested_fix: q.reasoning 
  }));

  for (let i = 0; i < qRows.length; i += 50) {
    await supabase.from('autopsy_questions').insert(qRows.slice(i, i + 50));
  }

  // 4. Generate Remediation Plan (Sync for UI)
  const incorrectQs = processedQuestions.filter((q: ProcessedQuestion) => q.status === 'Incorrect');
  const { mentorQuote, plan } = await generateMentorRecovery(autopsyData.id, currentScore, potentialScore, incorrectQs, examType);

  // 5. Fire the Event (Decoupled Architecture)
  const primaryCategory = Object.entries(
    incorrectQs.reduce((acc, q) => {
      if (q.mistakeCategory) acc[q.mistakeCategory] = (acc[q.mistakeCategory] || 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])[0]?.[0];

  // ── ATLAS + MEMORY PIPELINE ───────────────────────────────────────────────
  // ALL incorrect answers downscale ATLAS mastery.
  // Conceptual + calculation mistakes also auto-generate flashcards.
  // Run after DB persistence so we have autopsyData.id available.
  const incorrectForPipeline = processedQuestions.filter(
    (q: ProcessedQuestion) => q.status === 'Incorrect'
  );

  if (incorrectForPipeline.length > 0) {
    // Lazy import to avoid circular dependency at module load time
    const { resolveConceptByName } = await import('./concept-resolver');
    const { updateConceptState } = await import('./cognition-graph');
    const { createSingleCard } = await import('./revision-engine');

    // Process in parallel batches of 5 to avoid overwhelming Supabase
    const BATCH_SIZE = 5;
    for (let i = 0; i < incorrectForPipeline.length; i += BATCH_SIZE) {
      const batch = incorrectForPipeline.slice(i, i + BATCH_SIZE);

      await Promise.allSettled(
        batch.map(async (q: ProcessedQuestion) => {
          try {
            // Step 1 — Resolve concept in ATLAS
            const conceptId = await resolveConceptByName(userId, q.subject, q.chapter);

            // Step 2 — Downscale ATLAS mastery for this concept
            // weight = marksLost capped at 5 so a single bad question doesn't nuke mastery
            if (conceptId) {
              const weight = Math.min(q.marksLost, 5);
              await updateConceptState(conceptId, false, 0, weight);
            }

            // Step 3 — Auto-create flashcard for conceptual + calculation mistakes
            // (Not for silly/time_pressure — those don't need a card, just speed drills)
            const cardWorthy = ['conceptual', 'calculation', 'incomplete_knowledge', 'overconfidence', 'recall_failure'];
            if (q.mistakeCategory && cardWorthy.includes(q.mistakeCategory)) {
              const front = q.reasoning
                ? `Why did you get Q${q.questionNumber} wrong? (${q.chapter})`
                : `Review: ${q.chapter} — Question ${q.questionNumber}`;
              const back = q.reasoning || `Revisit ${q.chapter} in your ${q.subject} notes.`;

              await createSingleCard(
                userId,
                conceptId ?? '',
                front,
                back,
                q.subject,
                q.chapter
              );
            }
          } catch (err) {
            // Non-fatal: log and continue. One failed concept must not block the rest.
            logger.warn('AUTOPSY → ATLAS/MEMORY pipeline failed for one question', {
              userId,
              chapter: q.chapter,
              err,
            });
          }
        })
      );
    }

    logger.info('AUTOPSY → ATLAS → MEMORY pipeline complete', {
      userId,
      incorrectCount: incorrectForPipeline.length,
    });
  }
  // ── END PIPELINE ──────────────────────────────────────────────────────────

  // Publish AUTOPSY_COMPLETE to student_events so COMMAND and PULSE can react.
  // Non-blocking — UI result is already computed above.
  try {
    const supabaseForEvent = await createClient();
    await supabaseForEvent.from('student_events').insert({
      user_id: userId,
      event_type: 'AUTOPSY_COMPLETE',
      payload: {
        autopsyId: autopsyData.id,
        currentScore,
        potentialScore,
        recoverableMarks,
        primaryMistakeCategory: primaryCategory ?? null,
        incorrectCount: incorrectQs.length,
        examType,
      },
      status: 'pending',
      created_at: new Date().toISOString(),
    });
    logger.info('AUTOPSY_COMPLETE event published', { autopsyId: autopsyData.id });
  } catch (err) {
    logger.error('Failed to publish AUTOPSY_COMPLETE event', err);
  }

  // UI return mapping
  const categoryMap: Record<string, number> = {};
  const chapterMap: Record<string, number> = {};

  incorrectQs.forEach(q => {
    if (q.mistakeCategory) categoryMap[q.mistakeCategory] = (categoryMap[q.mistakeCategory] || 0) + 1;
    if (q.chapter) chapterMap[q.chapter] = (chapterMap[q.chapter] || 0) + q.marksLost;
  });

  const categoryBreakdown = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
  const chapterLoss = Object.entries(chapterMap)
    .map(([chapter, marksLost]) => ({ chapter, marksLost }))
    .sort((a, b) => b.marksLost - a.marksLost)
    .slice(0, 10); 

  return { 
    autopsyId: autopsyData.id, currentScore, potentialScore, recoverableMarks, mentorQuote, plan, examType, categoryBreakdown, chapterLoss
  };
}
