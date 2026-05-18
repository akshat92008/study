'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getMistakeAnalytics, analyzeMistake, generateMarkLossReport } from '@/lib/engines/mistake-engine';
import { safeError, logger } from '@/lib/utils/logger';

// Strict schema validation
const LogMistakeSchema = z.object({
  subject: z.string().min(1),
  chapter: z.string().min(1),
  topic: z.string().optional(),
  category: z.enum(['conceptual', 'calculation', 'silly', 'time_pressure', 'misread', 'incomplete_knowledge', 'overconfidence', 'anxiety', 'recall_failure']),
  questionText: z.string().optional().nullable(),
  userAnswer: z.string().optional().nullable(),
  correctAnswer: z.string().optional().nullable(),
  marksLost: z.coerce.number().min(0).max(100),
  totalMarks: z.coerce.number().min(0).max(100),
  timeSpent: z.coerce.number().optional().nullable(),
});

export async function getMistakeData() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return getMistakeAnalytics(user.id);
  } catch (err) {
    logger.error('Failed to get mistake data', err);
    return null;
  }
}

export async function logMistake(formData: FormData) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { error: 'Not authenticated' };

    // Validate incoming data
    const payload = LogMistakeSchema.parse({
      subject: formData.get('subject'),
      chapter: formData.get('chapter'),
      topic: formData.get('topic') || '',
      category: formData.get('category'),
      questionText: formData.get('questionText'),
      userAnswer: formData.get('userAnswer'),
      correctAnswer: formData.get('correctAnswer'),
      marksLost: formData.get('marksLost'),
      totalMarks: formData.get('totalMarks'),
      timeSpent: formData.get('timeSpent'),
    });

    // Get AI analysis
    const analysis = await analyzeMistake(payload);

    const { error } = await supabase.from('mistakes').insert({
      user_id: user.id,
      subject: payload.subject,
      chapter: payload.chapter,
      topic: payload.topic,
      category: payload.category,
      question_text: payload.questionText,
      user_answer: payload.userAnswer,
      correct_answer: payload.correctAnswer,
      marks_lost: payload.marksLost,
      total_marks: payload.totalMarks,
      time_spent_seconds: payload.timeSpent,
      ai_analysis: (analysis as any)?.rootCause || null,
      improvement_suggestion: (analysis as any)?.remediation || (analysis as any)?.fixStrategy || null,
    });

    if (error) throw error;
    
    logger.info('Mistake logged successfully', { userId: user.id, category: payload.category });
    return { success: true, analysis };

  } catch (err) {
    return safeError(err);
  }
}

export async function getMarkLossReport() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return generateMarkLossReport(user.id);
  } catch (err) {
    logger.error('Failed to generate mark loss report', err);
    return null;
  }
}
