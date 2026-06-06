'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getMistakeAnalytics, analyzeMistake, generateMarkLossReport } from '@/lib/engines/mistake-engine';
import { safeError, logger } from '@/lib/utils/logger';
import { upsertMistakeRisk } from '@/lib/services/repair-loop.service';

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
    
    const analytics = await getMistakeAnalytics(user.id);
    if (!analytics) return null;

    // Get all unique subjects and chapters for this user from concepts
    const { data: concepts } = await supabase
      .from('concepts')
      .select('subject, chapter')
      .eq('user_id', user.id);

    const subjectsAndChapters: Record<string, string[]> = {};
    if (concepts) {
      concepts.forEach((c: any) => {
        if (!subjectsAndChapters[c.subject]) {
          subjectsAndChapters[c.subject] = [];
        }
        if (!subjectsAndChapters[c.subject].includes(c.chapter)) {
          subjectsAndChapters[c.subject].push(c.chapter);
        }
      });
    }

    return {
      ...analytics,
      syllabus: subjectsAndChapters
    };
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
    const analysis = await analyzeMistake(user.id, payload);

    await upsertMistakeRisk(supabase, {
      userId: user.id,
      source: 'manual',
      subject: payload.subject,
      chapter: payload.chapter,
      topic: payload.topic || payload.chapter,
      concept: payload.topic || payload.chapter,
      mistakeText: payload.questionText || `${payload.category} mistake in ${payload.chapter}`,
      questionText: payload.questionText,
      userAnswer: payload.userAnswer,
      correctAnswer: payload.correctAnswer,
      whyWrong: (analysis as any)?.rootCause || null,
      examTrap: (analysis as any)?.remediation || (analysis as any)?.fixStrategy || null,
      severity: Math.max(1, Math.min(5, Math.ceil(Number(payload.marksLost || 1)))),
      category: payload.category,
      metadata: {
        marksLost: payload.marksLost,
        totalMarks: payload.totalMarks,
        timeSpent: payload.timeSpent,
      },
    });
    
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
