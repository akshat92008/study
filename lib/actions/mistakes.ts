'use server';

import { createClient } from '@/lib/supabase/server';
import { getMistakeAnalytics, analyzeMistake, generateMarkLossReport } from '@/lib/engines/mistake-engine';

export async function getMistakeData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getMistakeAnalytics(user.id);
}

export async function logMistake(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const mistakeData = {
    user_id: user.id,
    subject: formData.get('subject') as string,
    chapter: formData.get('chapter') as string,
    topic: formData.get('topic') as string || '',
    category: formData.get('category') as string,
    question_text: formData.get('questionText') as string || null,
    user_answer: formData.get('userAnswer') as string || null,
    correct_answer: formData.get('correctAnswer') as string || null,
    marks_lost: parseFloat(formData.get('marksLost') as string) || 4,
    total_marks: parseFloat(formData.get('totalMarks') as string) || 4,
    time_spent_seconds: parseInt(formData.get('timeSpent') as string) || null,
  };

  // Get AI analysis
  const analysis = await analyzeMistake({
    subject: mistakeData.subject,
    chapter: mistakeData.chapter,
    questionText: mistakeData.question_text || undefined,
    userAnswer: mistakeData.user_answer || undefined,
    correctAnswer: mistakeData.correct_answer || undefined,
    category: mistakeData.category,
  });

  const { error } = await supabase.from('mistakes').insert({
    ...mistakeData,
    ai_analysis: (analysis as any)?.rootCause || null,
    improvement_suggestion: (analysis as any)?.remediation || null,
  });

  if (error) return { error: error.message };
  return { success: true, analysis };
}

export async function getMarkLossReport() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return generateMarkLossReport(user.id);
}
