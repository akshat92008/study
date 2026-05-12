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
    total_questions: parseInt(formData.get('totalQuestions') as string) || 200,
    attempted: parseInt(formData.get('attempted') as string) || 0,
    correct: parseInt(formData.get('correct') as string) || 0,
    incorrect: parseInt(formData.get('incorrect') as string) || 0,
    total_marks: parseFloat(formData.get('totalMarks') as string) || 100,
    marks_obtained: parseFloat(formData.get('marksObtained') as string) || 0,
    negative_marks: parseFloat(formData.get('negativeMarks') as string) || 0,
    time_taken: parseInt(formData.get('timeTaken') as string) || 0,
    total_time: parseInt(formData.get('totalTime') as string) || 180,
    subject_wise: JSON.parse(formData.get('subjectWise') as string || '[]'),
  };

  testData.unattempted = testData.total_questions - testData.attempted;

  const { error } = await supabase.from('mock_tests').insert(testData);
  if (error) return { error: error.message };

  // Auto-generate AI insights about the test
  const prompt = `${examType} Mock Test Analysis:
Score: ${testData.marks_obtained}/${testData.total_marks}
Correct: ${testData.correct}, Incorrect: ${testData.incorrect}, Unattempted: ${testData.unattempted}
Time: ${testData.time_taken} minutes

Give a brief 2-sentence strategic assessment.`;

  const insight = await generateJSON<{ assessment: string }>('flash',
    `You are a ${examType} exam analyst.`, prompt + '\nRespond as: {"assessment": "..."}');

  return { success: true, insight: (insight as any)?.assessment };
}
