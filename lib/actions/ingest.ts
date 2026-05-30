'use server';

import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';

export async function logMockTest(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated' };

  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', user.id).single();
  const examType = profile?.exam_type || 'General';

  const testData = {
    user_id: user.id,
    test_name: formData.get('testName') as string,
    exam_type: examType,
    total_questions: parseInt(formData.get('totalQuestions') as string) || 200,
    correct_count: parseInt(formData.get('correct') as string) || 0,
    incorrect_count: parseInt(formData.get('incorrect') as string) || 0,
    total_marks: parseFloat(formData.get('totalMarks') as string) || 100,
    current_score: parseFloat(formData.get('marksObtained') as string) || 0,
    recoverable_marks: 0,
    potential_score: 0,
    unattempted_count: 0,
    diagnosis: { subject_wise: JSON.parse(formData.get('subjectWise') as string || '[]') },
    status: 'completed',
    completed_at: new Date().toISOString(),
  };

  testData.unattempted_count = Math.max(0, testData.total_questions - testData.correct_count - testData.incorrect_count);
  testData.recoverable_marks = Math.max(0, testData.incorrect_count * 0.5);
  testData.potential_score = testData.total_marks;

  const { error } = await supabase.from('mock_autopsies').insert(testData);
  if (error) return { error: error.message };

  // Auto-generate AI insights about the test
  const prompt = `${examType} Mock Test Analysis:
Score: ${testData.current_score}/${testData.total_marks}
Correct: ${testData.correct_count}, Incorrect: ${testData.incorrect_count}, Unattempted: ${testData.unattempted_count}

Give a brief 2-sentence strategic assessment.`;

  const insight = await generateJSON<{ assessment: string }>('flash',
    `You are a ${examType} exam analyst.`, prompt + '\nRespond as: {"assessment": "..."}');

  return { success: true, insight: (insight as any)?.assessment };
}
