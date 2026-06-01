import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { AutopsyPaperSchema, AutopsyQuestionSchema } from './autopsy-schemas';
import { logger } from '@/lib/utils/logger';
import { generateJSON, generateMultimodalJSON } from '@/lib/ai/provider-client';

/** Typed error thrown when extraction completely fails (safe for callers to detect). */
export class AutopsyExtractionError extends Error {
  readonly extractionFailed = true;
  constructor(message: string) {
    super(message);
    this.name = 'AutopsyExtractionError';
  }
}

export class AutopsyNeedsUserInputError extends Error {
  readonly needsUserInput = true;
  constructor(message: string) {
    super(message);
    this.name = 'AutopsyNeedsUserInputError';
  }
}

type AutopsyFileData =
  | { kind: 'text'; text: string }
  | { kind: 'inline'; mimeType: string; data: string };

type AutopsyQuestion = z.infer<typeof AutopsyQuestionSchema>;
type ProcessedQuestion = AutopsyQuestion & {
  marksLost: number;
  needsReview?: boolean;
  correctExplanation?: string | null;
  conceptualGap?: string | null;
};

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MIN_EXTRACTION_CONFIDENCE = 70;
/** Safety cap: refuse to process more than 250 questions in a single autopsy */
const MAX_QUESTION_COUNT = 250;

function autopsyIdempotencyKey(
  userId: string,
  testName: string,
  examType: string,
  fileData: AutopsyFileData
): string {
  const hash = createHash('sha256');
  hash.update(userId);
  hash.update('\n');
  hash.update(testName);
  hash.update('\n');
  hash.update(examType);
  hash.update('\n');
  hash.update(fileData.kind);
  hash.update('\n');
  hash.update(fileData.kind === 'text' ? fileData.text : fileData.data);
  return `autopsy:${hash.digest('hex')}`;
}

function clientAutopsyIdempotencyKey(userId: string, idempotencyKey: string): string {
  const hash = createHash('sha256');
  hash.update(userId);
  hash.update('\n');
  hash.update(idempotencyKey.trim());
  return `autopsy:client:${hash.digest('hex')}`;
}

async function routeMultimodalExtraction(
  prompt: string,
  fileData: { kind: 'inline'; mimeType: string; data: string }
): Promise<any> {
  return generateMultimodalJSON(prompt, {
    mimeType: fileData.mimeType,
    data: fileData.data,
  });
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
- Determine status: "Correct", "Incorrect", or "Unattempted" only from explicit evidence: answer key, student answer, OMR marks, score/result table, or visible correct/wrong markings.
- If the upload only contains a question paper without answer key, student answers, OMR/result markings, or score data, return {"questions":[],"overallPaperQuality":"needs_user_input: answer key, student answers, OMR sheet, or result sheet required"}.
- Do not infer or invent mistakes from question text alone.
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
      if (attempt >= retries) {
        // Throw typed error so the route can return a safe, structured response
        // without leaking raw AI/parse error messages to the client.
        throw new AutopsyExtractionError('AI failed to extract document format reliably. The file may be unreadable, corrupt, or contain unsupported content.');
      }
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }

  throw new AutopsyExtractionError('Unreachable extraction state');
}

function textNeedsAnswerEvidence(text: string): boolean {
  const sample = text.slice(0, 8000).toLowerCase();
  const evidencePatterns = [
    /\b(correct|incorrect|wrong|right|unattempted|attempted)\b/,
    /\b(answer key|student answer|your answer|marked answer|omr|response sheet|result|score|marks)\b/,
    /\b(ans|key)\s*[:=]/,
    /\b[abcd]\s*(?:->|=>|=)\s*[abcd]\b/,
  ];
  return !evidencePatterns.some(pattern => pattern.test(sample));
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
  customScoring?: { correctMarks: number; negativeMarks: number },
  authenticatedClient?: SupabaseClient,
  requestedIdempotencyKey?: string | null
): Promise<any> {
  if (fileData.kind === 'text' && textNeedsAnswerEvidence(fileData.text)) {
    throw new AutopsyNeedsUserInputError(
      'AUTOPSY needs answer evidence before it can classify mistakes. Upload an answer key, student answers, OMR sheet, or result sheet with the question paper.'
    );
  }

  if (fileData.kind === 'inline') {
    const byteSize = Buffer.byteLength(fileData.data, 'base64');
    if (byteSize > MAX_FILE_BYTES) {
      throw new AutopsyExtractionError(
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

  // Safety gate: refuse to process suspiciously large question sets
  if (allQuestions.length > MAX_QUESTION_COUNT) {
    throw new AutopsyExtractionError(
      `Extracted ${allQuestions.length} questions which exceeds the maximum of ${MAX_QUESTION_COUNT}. ` +
      'The file may be corrupt or contain multiple test papers concatenated together.'
    );
  }

  // If no questions were extracted at all, fail safely rather than creating an
  // empty autopsy record that would confuse the learner.
  if (allQuestions.length === 0) {
    if (/needs_user_input/i.test(paper.overallPaperQuality || '')) {
      throw new AutopsyNeedsUserInputError(
        'AUTOPSY needs answer evidence before it can classify mistakes. Upload an answer key, student answers, OMR sheet, or result sheet with the question paper.'
      );
    }
    throw new AutopsyExtractionError(
      'No questions could be extracted from the provided file. ' +
      'Please ensure the file contains a readable mock test with clear question numbering.'
    );
  }

  const verifiedQuestions = allQuestions.filter(q => (q.ocrConfidence ?? 100) >= MIN_EXTRACTION_CONFIDENCE);
  const needsReviewQuestions = allQuestions.filter(q => (q.ocrConfidence ?? 100) < MIN_EXTRACTION_CONFIDENCE);
  const incorrectQuestions = verifiedQuestions.filter(q => q.status === 'Incorrect');
  const correctQuestions  = verifiedQuestions.filter(q => q.status === 'Correct');
  const unattempted       = verifiedQuestions.filter(q => q.status === 'Unattempted');

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
    ...needsReviewQuestions.map(q => ({
      ...q,
      status: 'NeedsReview' as const,
      marksLost: 0,
      needsReview: true,
      mistakeCategory: null,
      reasoning: 'Extraction confidence below review threshold; learner state was not mutated.',
    })),
  ];

  const supabase = authenticatedClient ?? await createClient();

  const questionsPayload = processedQuestions.map(q => {
    // Confidence propagation:
    // - ocrConfidence comes from Pass 1 (image/text quality)
    // - For items that went through the diagnostic pass (Pass 2) without error,
    //   we trust the OCR confidence as the extraction confidence.
    // - For needsReview items, we explicitly clamp confidence to 0 so the RPC
    //   routing always puts them in needs_review regardless of threshold.
    const baseConfidence = q.ocrConfidence ?? 100;
    const effectiveConfidence = (q.needsReview || q.status === 'NeedsReview')
      ? 0  // force below threshold → RPC assigns needs_review
      : baseConfidence;

    return {
      questionNumber: q.questionNumber,
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      difficulty: q.difficulty,
      status: q.status,
      questionText: q.questionText,
      correctAnswer: q.correctAnswer,
      studentAnswer: q.studentAnswer,
      mistakeCategory: q.mistakeCategory ?? null,
      reasoning: q.reasoning ?? null,
      conceptualGap: (q as any).conceptualGap ?? null,
      correctExplanation: (q as any).correctExplanation ?? null,
      marksLost: q.marksLost,
      totalMarks: correctMarks,
      needsReview: q.needsReview || false,
      // Pass both fields — RPC prefers extractionConfidence
      ocrConfidence: effectiveConfidence,
      extractionConfidence: effectiveConfidence,
    };
  });

  const idempotencyKey = requestedIdempotencyKey?.trim()
    ? clientAutopsyIdempotencyKey(userId, requestedIdempotencyKey)
    : autopsyIdempotencyKey(userId, testName, examType, fileData);
  const traceId = randomUUID();
  const { data: ingestResult, error: autopsyError } = await supabase.rpc('ingest_mock_autopsy', {
    p_user_id: userId,
    p_test_name: testName,
    p_exam_type: examType,
    p_total_questions: allQuestions.length,
    p_correct_count: correctQuestions.length,
    p_incorrect_count: incorrectQuestions.length,
    p_unattempted_count: unattempted.length,
    p_current_score: rawScore,
    p_recoverable_marks: recoverableMarks,
    p_potential_score: potentialScore,
    p_questions: questionsPayload,
    p_idempotency_key: idempotencyKey,
    p_trace_id: traceId,
    p_confidence_threshold: MIN_EXTRACTION_CONFIDENCE,
  });

  if (autopsyError || !ingestResult?.autopsy_id) {
    throw new Error(`Failed to save autopsy: ${autopsyError?.message ?? 'unknown error'}`);
  }

  const autopsyId = ingestResult.autopsy_id as string;

  logger.info('AUTOPSY_MOCK_PROCESSED event enqueued transactionally', {
    userId,
    autopsyId,
    eventId: ingestResult.event_id,
  });

  return {
    autopsyId,
    eventId: ingestResult.event_id ?? null,
    testName,
    scores: { raw: rawScore, recoverable: recoverableScore, potential: potentialScore },
    counts: {
      total: allQuestions.length,
      correct: correctQuestions.length,
      incorrect: incorrectQuestions.length,
      unattempted: unattempted.length,
      needsReview: needsReviewQuestions.length,
    },
    recoverableMarks,
    diagnosedQuestions: processedQuestions,
    needsReviewQuestions: processedQuestions.filter(q => q.needsReview),
    mentorMessage: null,
    recoveryPlan: null,
  };
}
