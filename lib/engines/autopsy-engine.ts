import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { AutopsyPaperSchema, AutopsyQuestionSchema } from './autopsy-schemas';
import { generateMentorRecovery } from './mentor-engine';
import { logger } from '@/lib/utils/logger';
import { generateJSON } from '@/lib/ai/gemini';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { generateKnowledgeUpdate } from './knowledge-engine';

type AutopsyFileData =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

type AutopsyQuestion = z.infer<typeof AutopsyQuestionSchema>;
type ProcessedQuestion = AutopsyQuestion & {
  marksLost: number;
  correctExplanation?: string | null;
  conceptualGap?: string | null;
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;

async function routeMultimodalExtraction(
  prompt: string,
  fileData: { kind: 'inline'; mimeType: string; data: string }
): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is required for image/PDF autopsy. ' +
      'Get one free at https://aistudio.google.com/app/apikey'
    );
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inlineData: { mimeType: fileData.mimeType, data: fileData.data } },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Multimodal extraction failed: ${response.status} ${text}`);
  }

  const data = await response.json();
  const rawText = (data.candidates?.[0]?.content?.parts?.[0]?.text || '{}')
    .replace(/```json/gi, '').replace(/```/g, '').trim();

  return JSON.parse(rawText);
}

async function fastExtractionPass(
  fileData: AutopsyFileData,
  subjectList: string,
  retries = 3
): Promise<z.infer<typeof AutopsyPaperSchema>> {
  const extractionPrompt = `
Extract all questions from this mock test submission. It may be a PDF, low-quality scan, OMR sheet, or handwritten.

RULES:
- Identify the question number.
- Map to a subject: [${subjectList}] and its chapter.
- Determine status: "Correct", "Incorrect", or "Unattempted".
- Provide an "ocrConfidence" score (0-100).
- Leave "mistakeCategory" and "reasoning" null for now.

Output strictly as JSON. No markdown.
`.trim();

  let attempt = 0;
  let delay = 1000;

  while (attempt < retries) {
    try {
      let rawResult: any;

      if (fileData.kind === 'text') {
        rawResult = await generateJSON<any>(
          'flash',
          'You are a mock test extraction engine. Respond ONLY with JSON.',
          `${extractionPrompt}\n\nTest Data:\n${fileData.text}`
        );
      } else {
        rawResult = await routeMultimodalExtraction(extractionPrompt, fileData);
      }

      return AutopsyPaperSchema.parse(rawResult);
    } catch (err: any) {
      attempt++;
      logger.warn(`Pass 1 failed (attempt ${attempt}/${retries})`, { error: err.message });
      if (attempt >= retries) throw new Error('AI failed to extract document format reliably.');
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new Error('Unreachable');
}

async function deepDiagnosticPass(
  incorrectQuestions: AutopsyQuestion[]
): Promise<ProcessedQuestion[]> {
  if (incorrectQuestions.length === 0) return [];

  const diagnosticPrompt = `
You are an expert exam performance analyst. Diagnose each incorrect answer.

For each question provide:
- mistakeCategory: one of [conceptual_gap, calculation_error, silly_mistake, time_pressure, misread_question, incomplete_knowledge, overconfidence, anxiety_blank, recall_failure]
- reasoning: one sentence explaining why this student got this wrong
- conceptualGap: the specific concept they need to study, or null for silly/time mistakes
- correctExplanation: one-sentence explanation of the correct approach

Questions to diagnose:
${JSON.stringify(incorrectQuestions.map(q => ({
  questionNumber: q.questionNumber,
  subject: q.subject,
  chapter: q.chapter,
  status: q.status,
})))}

Respond ONLY as a JSON array of the same length. No markdown.
`.trim();

  try {
    const diagnosed = await generateJSON<any[]>(
      'pro',
      'You are an expert exam analyst. Return JSON array only.',
      diagnosticPrompt
    );

    if (!Array.isArray(diagnosed)) return incorrectQuestions.map(q => ({ ...q, marksLost: 0 }));

    return incorrectQuestions.map((q, i) => ({
      ...q,
      marksLost: 0,
      mistakeCategory: diagnosed[i]?.mistakeCategory ?? q.mistakeCategory,
      reasoning: diagnosed[i]?.reasoning ?? q.reasoning,
      conceptualGap: diagnosed[i]?.conceptualGap ?? null,
      correctExplanation: diagnosed[i]?.correctExplanation ?? null,
    }));
  } catch (err) {
    logger.warn('Deep diagnostic pass failed, using undiagnosed', err);
    return incorrectQuestions.map(q => ({ ...q, marksLost: 0 }));
  }
}

export async function processMockAutopsy(
  userId: string,
  fileData: AutopsyFileData,
  testName: string,
  examType: string,
  customScoring?: { correctMarks: number; negativeMarks: number }
): Promise<any> {
  if (fileData.kind === 'inline') {
    const byteSize = Buffer.byteLength(fileData.data, 'base64');
    if (byteSize > MAX_FILE_BYTES) {
      throw new Error(
        `File too large (${Math.round(byteSize / 1024 / 1024)}MB). Maximum allowed is 20MB.`
      );
    }
  }

  let examConfig = getExamConfig(examType);
  if (customScoring) {
    examConfig = { ...examConfig, ...customScoring };
  }
  const subjectList = examConfig.subjects.join(', ');

  logger.info('Autopsy Pass 1: Extracting', { userId, testName });
  const paper = await fastExtractionPass(fileData, subjectList);
  const allQuestions: AutopsyQuestion[] = paper.questions || [];

  const incorrectQuestions = allQuestions.filter(q => q.status === 'Incorrect');
  const correctQuestions  = allQuestions.filter(q => q.status === 'Correct');
  const unattempted       = allQuestions.filter(q => q.status === 'Unattempted');

  logger.info('Autopsy Pass 2: Diagnosing', { userId, incorrect: incorrectQuestions.length });
  const diagnosedIncorrect = await deepDiagnosticPass(incorrectQuestions);

  const { correctMarks, negativeMarks } = examConfig;
  const rawScore =
    correctQuestions.length * correctMarks -
    incorrectQuestions.length * Math.abs(negativeMarks);

  const recoverableCategories = new Set([
    'silly_mistake', 'time_pressure', 'misread_question', 'recall_failure',
  ]);
  const recoverableMarks = diagnosedIncorrect
    .filter(q => q.mistakeCategory && recoverableCategories.has(q.mistakeCategory))
    .reduce((sum) => sum + correctMarks + Math.abs(negativeMarks), 0);

  const recoverableScore = rawScore + recoverableMarks;
  const potentialScore   = allQuestions.length * correctMarks;

  const processedQuestions: ProcessedQuestion[] = [
    ...correctQuestions.map(q  => ({ ...q, marksLost: 0 })),
    ...diagnosedIncorrect.map(q => ({ ...q, marksLost: Math.abs(negativeMarks) + correctMarks })),
    ...unattempted.map(q       => ({ ...q, marksLost: correctMarks })),
  ];

  const supabase = await createClient();

  const { data: autopsyRecord, error: autopsyError } = await supabase
    .from('mock_autopsies')
    .insert({
      user_id: userId,
      test_name: testName,
      exam_type: examType,
      total_questions: allQuestions.length,
      correct_count: correctQuestions.length,
      incorrect_count: incorrectQuestions.length,
      unattempted_count: unattempted.length,
      current_score: rawScore,
      recoverable_marks: recoverableMarks,
      potential_score: potentialScore,
    })
    .select('id')
    .single();

  if (autopsyError || !autopsyRecord) {
    throw new Error(`Failed to save autopsy: ${autopsyError?.message}`);
  }

  const CHUNK = 50;
  for (let i = 0; i < processedQuestions.length; i += CHUNK) {
    const { error: questionInsertError } = await supabase.from('autopsy_questions').insert(
      processedQuestions.slice(i, i + CHUNK).map(q => ({
        autopsy_id: autopsyRecord.id,
        user_id: userId,
        question_number: q.questionNumber,
        subject: q.subject,
        chapter: q.chapter,
        status: q.status,
        mistake_category: q.mistakeCategory ?? null,
        reasoning: q.reasoning ?? null,
        marks_lost: q.marksLost,
        ocr_confidence: q.ocrConfidence ?? 100,
      }))
    );

    if (questionInsertError) {
      throw new Error(`Failed to save autopsy questions: ${questionInsertError.message}`);
    }
  }

  await generateKnowledgeUpdate(userId, diagnosedIncorrect).catch(err => logger.error('Knowledge sync failed', err));

  const mentorResult = await generateMentorRecovery(
    autopsyRecord.id, rawScore, potentialScore, diagnosedIncorrect, examType
  ).catch(err => { logger.warn('Mentor recovery failed', err); return null; });

  await EventDispatcher.publish({
    user_id: userId,
    type: 'AUTOPSY_MOCK_PROCESSED',
    data: {
      autopsyId: autopsyRecord.id,
      testName,
      examType,
      rawScore,
      recoverableScore,
      potentialScore,
      totalQuestions: allQuestions.length,
      correctCount: correctQuestions.length,
      incorrectCount: incorrectQuestions.length,
    },
    metadata: {
      source: 'autopsy_engine',
      autopsyId: autopsyRecord.id,
      wrongQuestions: diagnosedIncorrect.map(q => ({
        questionNumber: q.questionNumber,
        subject: q.subject,
        chapter: q.chapter,
        mistakeCategory: q.mistakeCategory,
        reasoning: q.reasoning,
        correctExplanation: q.correctExplanation ?? null,
        conceptualGap: q.conceptualGap ?? null,
      })),
    },
    idempotency_key: `autopsy:${autopsyRecord.id}:processed`,
  });
  logger.info('AUTOPSY_MOCK_PROCESSED event fired', { userId });

  return {
    autopsyId: autopsyRecord.id,
    testName,
    scores: { raw: rawScore, recoverable: recoverableScore, potential: potentialScore },
    counts: {
      total: allQuestions.length,
      correct: correctQuestions.length,
      incorrect: incorrectQuestions.length,
      unattempted: unattempted.length,
    },
    recoverableMarks,
    diagnosedQuestions: processedQuestions,
    mentorMessage: mentorResult?.mentorQuote ?? null,
    recoveryPlan: mentorResult?.plan ?? null,
  };
}
