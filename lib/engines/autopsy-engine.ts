import { createClient } from '@/lib/supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getExamConfig } from '@/lib/utils/constants';
import { AutopsyPaperSchema, AutopsyQuestionSchema } from './autopsy-schemas';
import { logger } from '@/lib/utils/logger';
import { classifyMistake } from '../autopsy/classifier';
import { budgetedGenerateJSON, budgetedGenerateMultimodalJSON } from '@/lib/ai/budgeted';

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
  evidenceStatus?: string;
  mistakeType?: string;
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
  userId: string,
  prompt: string,
  fileData: { kind: 'inline'; mimeType: string; data: string }
): Promise<z.infer<typeof AutopsyPaperSchema>> {
  return budgetedGenerateMultimodalJSON<z.infer<typeof AutopsyPaperSchema>>({
    userId,
    feature: 'autopsy',
    route: 'autopsy:extraction-multimodal',
    model: 'router:multimodal+pro',
    systemPrompt: 'You are a mock test extraction engine. Respond ONLY with JSON.',
    fileData: { mimeType: fileData.mimeType, data: fileData.data },
    schema: AutopsyPaperSchema,
    maxOutputTokens: 2000
  });
}

async function fastExtractionPass(
  userId: string,
  fileData: AutopsyFileData,
  subjectList: string,
  retries = 3
): Promise<z.infer<typeof AutopsyPaperSchema>> {
  if (fileData.kind === 'inline' && fileData.mimeType === 'application/pdf') {
    try {
      const { default: pdfParse } = await import('pdf-parse');
      const buffer = Buffer.from(fileData.data, 'base64');
      const pdfData = await pdfParse(buffer);
      if (pdfData.text && pdfData.text.trim().length > 100) {
        fileData = { kind: 'text', text: pdfData.text };
      }
    } catch (e) {
      import('@/lib/utils/logger').then(({ logger }) => {
        logger.warn('Failed to parse PDF as text, falling back to multimodal', { error: String(e) });
      });
    }
  }

  const extractionPrompt = `
Extract all questions from this mock test submission. It may be a PDF, low-quality scan, OMR sheet, handwritten paper, code snippet, essay, or structured rubric.

RULES:
- Identify the question number.
- Map to a subject: [${subjectList}] and its chapter.
- Determine status: "Correct", "Incorrect", or "Unattempted" only from explicit evidence: answer key, student answer, OMR marks, score/result table, rubric feedback, grading notes, or visible correct/wrong markings.
- If the upload only contains a question paper without answer key, student answers, OMR/result markings, rubric feedback, or score data, return {"questions":[],"overallPaperQuality":"needs_user_input: answer key, student answers, feedback, or result sheet required"}.
- Do not infer or invent mistakes from question text alone. For non-MCQ questions (short answer, essays, code), treat the student's submission and grading feedback as the 'studentAnswer' and 'correctAnswer'.
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
        rawResult = await budgetedGenerateJSON<z.infer<typeof AutopsyPaperSchema>>({
          userId,
          feature: 'autopsy',
          route: 'autopsy:extraction-text',
          model: 'quality',
          systemPrompt: 'You are a mock test extraction engine. Respond ONLY with JSON.',
          userPrompt: `${extractionPrompt}\n\nTest Data:\n${fileData.text}`,
          schema: AutopsyPaperSchema,
          maxOutputTokens: 2000
        });
      } else {
        rawResult = await routeMultimodalExtraction(userId, extractionPrompt, fileData);
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
    /\b(answer key|student answer|your answer|marked answer|omr|response sheet|result|score|marks|feedback|rubric|points|grade|passed|failed|error|exception)\b/,
    /\b(ans|key)\s*[:=]/,
    /\b[abcd]\s*(?:->|=>|=)\s*[abcd]\b/,
  ];
  return !evidencePatterns.some(pattern => pattern.test(sample));
}

async function deepDiagnosticPass(
  userId: string,
  incorrectQuestions: AutopsyQuestion[]
): Promise<ProcessedQuestion[]> {
  if (incorrectQuestions.length === 0) return [];

  const results: ProcessedQuestion[] = [];
  
  for (const q of incorrectQuestions) {
    const classification = await classifyMistake({
      userId,
      questionText: q.questionText ?? undefined,
      studentAnswer: q.studentAnswer ?? undefined,
      correctAnswer: q.correctAnswer ?? undefined,
      explanation: q.reasoning ?? undefined,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.subtopic ?? undefined,
      confidence: (q.ocrConfidence ?? 100) / 100, // Pass 0 to 1
    });

    results.push({
      ...q,
      marksLost: 0,
      mistakeCategory: (classification.mistakeType ?? q.mistakeCategory ?? undefined) as any,
      mistakeType: (classification.mistakeType ?? undefined) as any,
      reasoning: classification.shortReason ?? q.reasoning ?? undefined,
      conceptualGap: classification.conceptName ?? undefined,
      correctExplanation: null,
      evidenceStatus: classification.evidenceStatus,
      needsReview: classification.evidenceStatus === 'needs_review',
    });
  }

  return results;
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
      'Mistake Review needs answer evidence before it can classify mistakes. Upload an answer key, student answers, OMR sheet, or result sheet with the question paper.'
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
  const paper = await fastExtractionPass(userId, fileData, subjectList);
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
        'Mistake Review needs answer evidence before it can classify mistakes. Upload an answer key, student answers, OMR sheet, or result sheet with the question paper.'
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
  const diagnosedIncorrect = await deepDiagnosticPass(userId, incorrectQuestions);

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
      mistakeType: q.mistakeType ?? null,
      reasoning: q.reasoning ?? null,
      conceptualGap: (q as any).conceptualGap ?? null,
      correctExplanation: (q as any).correctExplanation ?? null,
      marksLost: q.marksLost,
      totalMarks: correctMarks,
      needsReview: q.needsReview || false,
      evidenceStatus: q.evidenceStatus,
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
