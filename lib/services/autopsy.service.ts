// lib/services/autopsy.service.ts

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { uuid } from 'drizzle-orm/pg-core';
import { mockAutopsies, autopsyQuestions, mistakes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import type { SupabaseClient } from '@supabase/supabase-js';
import pdf from 'pdf-parse';
import { parse as csvParse } from 'csv-parse/sync';

export type RawQuestion = {
  questionNumber: number;
  subject: string;
  chapter?: string;
  subtopic?: string;
  difficulty?: string;
  questionText: string;
  correctAnswer: string;
  studentAnswer?: string;
  timeSpentSeconds?: number;
};

/** Simple heuristic classifier for wrong answers */
function classifyRootCause(answer: string, correct: string): {
  rootCause: string;
  conceptName?: string;
  confidence: number;
} {
  const cleaned = answer.trim().toLowerCase();
  if (!cleaned) return { rootCause: 'anxiety_blank', confidence: 0.9 };
  if (cleaned.length < 3) return { rootCause: 'silly', confidence: 0.8 };
  if (cleaned.includes('i don\'t know') || cleaned.includes('guess'))
    return { rootCause: 'guessed', confidence: 0.7 };
  // Very naive concept detection – look for keyword overlap with correct answer
  const overlap = cleaned.split(' ').filter((w) => correct.toLowerCase().includes(w)).length;
  if (overlap > 0) {
    return { rootCause: 'conceptual', confidence: 0.6 };
  }
  // Default to calculation or time pressure based on length
  if (cleaned.length > 20) return { rootCause: 'calculation', confidence: 0.5 };
  return { rootCause: 'time_pressure', confidence: 0.5 };
}

/** Extract raw text from uploaded file */
async function extractText(file: File): Promise<string> {
  const mime = file.type;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (mime === 'application/pdf') {
    const data = await pdf(buffer);
    return data.text;
  }
  if (mime.startsWith('image/')) {
    logger.warn('Tesseract OCR disabled to prevent crashes.');
    return 'OCR fallback disabled. Please provide raw text or use an API.';
  }
  // Assume CSV – return raw text for later parsing
  return buffer.toString('utf-8');
}

/** Normalise raw text into structured questions – placeholder implementation */
function normaliseQuestions(rawText: string): RawQuestion[] {
  // Very simple CSV split – expects columns in order
  try {
    const records = csvParse(rawText, { columns: true, skip_empty_lines: true }) as any[];
    return records.map((r, idx) => ({
      questionNumber: Number(r.questionNumber) || idx + 1,
      subject: r.subject || 'General',
      chapter: r.chapter,
      subtopic: r.subtopic,
      difficulty: r.difficulty,
      questionText: r.questionText,
      correctAnswer: r.correctAnswer,
      studentAnswer: r.studentAnswer,
      timeSpentSeconds: r.timeSpent ? Number(r.timeSpent) : undefined,
    }));
  } catch (_) {
    // Fallback – split by lines assuming a simple line format "Q|Subject|Correct|Student"
    const lines = rawText.split('\n').filter(Boolean);
    return lines.map((line, i) => {
      const parts = line.split('|');
      return {
        questionNumber: i + 1,
        subject: parts[1] || 'General',
        questionText: parts[0] || '',
        correctAnswer: parts[2] || '',
        studentAnswer: parts[3] || '',
      } as RawQuestion;
    });
  }
}

/** Main entry – process a mock test */
export async function processAutopsy(params: {
  userId: string;
  testName: string;
  examType?: string;
  rawFile?: File;
  manualQuestions?: RawQuestion[];
}) {
  const supabase = await createClient();
  const { userId, testName, examType = 'General Study', rawFile, manualQuestions } = params;

  let rawText = '';
  if (rawFile) {
    rawText = await extractText(rawFile);
  } else if (manualQuestions) {
    // When manual entry, we skip OCR – we already have structured data
  }

  const questions: RawQuestion[] = manualQuestions ?? normaliseQuestions(rawText);

  // Insert mock_autopsies row
  const mockRes = await supabase
    .from('mock_autopsies')
    .insert({
      user_id: userId,
      test_name: testName,
      exam_type: examType,
      total_questions: questions.length,
    })
    .select('id')
    .single();

  if (mockRes.error) {
    logger.error('Failed to insert mock_autopsy', mockRes.error);
    throw new Error('Autopsy insertion failed');
  }
  const mockId = mockRes.data.id;

  // Prepare batch inserts
  const autopsyRows: any[] = [];
  const mistakeRows: any[] = [];

  for (const q of questions) {
    const isCorrect = q.studentAnswer?.trim() === q.correctAnswer?.trim();
    const status = isCorrect ? 'Correct' : q.studentAnswer ? 'Incorrect' : 'Unattempted';

    const classification = !isCorrect && q.studentAnswer ? classifyRootCause(q.studentAnswer, q.correctAnswer) : null;

    autopsyRows.push({
      autopsy_id: mockId,
      question_number: q.questionNumber,
      subject: q.subject,
      chapter: q.chapter,
      subtopic: q.subtopic,
      difficulty: q.difficulty || 'Medium',
      status,
      correct_answer: q.correctAnswer,
      student_answer: q.studentAnswer,
      mistake_category: classification?.rootCause,
    });

    if (!isCorrect && q.studentAnswer) {
      mistakeRows.push({
        user_id: userId,
        concept_id: null, // concept linking can be added later
        category: classification?.rootCause || 'unknown',
        subject: q.subject,
        chapter: q.chapter || '',
        topic: q.subtopic || '',
        question_text: q.questionText,
        user_answer: q.studentAnswer,
        correct_answer: q.correctAnswer,
        marks_lost: 1, // placeholder – real logic can compute based on marks schema
        total_marks: 1,
        time_spent_seconds: q.timeSpentSeconds,
        ai_analysis: null,
        improvement_suggestion: null,
        is_recurring: false,
        occurrence_count: 1,
      });
    }
  }

  // Bulk insert autopsy_questions
  const batchSize = 500;
  for (let i = 0; i < autopsyRows.length; i += batchSize) {
    const slice = autopsyRows.slice(i, i + batchSize);
    const res = await supabase.from('autopsy_questions').insert(slice);
    if (res.error) logger.error('Failed to insert autopsy_questions batch', res.error);
  }

  // Bulk insert mistakes
  for (let i = 0; i < mistakeRows.length; i += batchSize) {
    const slice = mistakeRows.slice(i, i + batchSize);
    const res = await supabase.from('mistakes').insert(slice);
    if (res.error) logger.error('Failed to insert mistakes batch', res.error);
  }

  // Publish event
  await EventDispatcher.publish({
    user_id: userId,
    type: 'AUTOPSY_MOCK_PROCESSED',
    data: {
      mockId,
      totalQuestions: questions.length,
      wrongAnswers: mistakeRows.length,
    },
  });

  // Return summary JSON
  const overallDiagnosis = mistakeRows.length > 0 ? 'Needs improvement' : 'Excellent';
  return {
    overallDiagnosis,
    recoverableMarks: mistakeRows.length * 0.5, // naive estimate
    conceptRebuildMarks: mistakeRows.length * 1,
    questions: autopsyRows.map((row) => ({
      questionNumber: row.question_number,
      isCorrect: row.status === 'Correct',
      rootCause: row.mistake_category || null,
      conceptName: null,
      confidence: 0.7,
      studentFacingLesson: null,
      atlasImpact: null,
      memoryCardSeed: { shouldCreate: false, front: '', back: '' },
    })),
    nextSevenDays: [],
  };
}

// Helper to fetch recent messages – reused from previous codebase (placeholder)
export async function getRecentMessages(userId: string, limit = 20) {
  // This function can be implemented based on existing chat memory service if needed.
  return [] as any;
}
