import { generateJSON } from '@/lib/ai/gemini';
import { createClient } from '@/lib/supabase/server';
import { getExamConfig } from '@/lib/utils/constants';

export async function generateDailyPlan(userId: string, date: string) {
  const supabase = await createClient();

  const [profileRes, conceptsRes, tasksRes, mistakesRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('concepts').select('subject, chapter, mastery, forgetting_probability')
      .eq('user_id', userId).in('mastery', ['not_started', 'exposed', 'developing']),
    supabase.from('study_tasks').select('*').eq('user_id', userId)
      .gte('scheduled_date', date).lte('scheduled_date', date),
    supabase.from('mistakes').select('subject, chapter, category')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
  ]);

  const profile = profileRes.data;
  const weakConcepts = (conceptsRes.data || []).slice(0, 15);
  const existingTasks = tasksRes.data || [];
  const recentMistakes = mistakesRes.data || [];

  // Don't regenerate if tasks exist
  if (existingTasks.length > 0) return existingTasks;

  const hoursPerDay = profile?.study_hours_per_day || 8;
  const examType = profile?.exam_type || 'NEET';
  const examConfig = getExamConfig(examType);
  const subjectList = examConfig.subjects.join(', ');

  const prompt = `Generate a daily study plan for a student preparing for ${examType}.

Date: ${date}
Exam: ${examType}
Subjects: ${subjectList}
Study Hours Available: ${hoursPerDay}
Student Emotional State: ${profile?.emotional_state || 'neutral'}
Target Score: ${profile?.target_score || 'Not set'}

Weak Concepts (prioritize these):
${weakConcepts.map(c => `- ${c.subject}: ${c.chapter} (${c.mastery})`).join('\n')}

Recent Mistake Areas:
${recentMistakes.map(m => `- ${m.subject}/${m.chapter}: ${m.category}`).join('\n')}

Rules:
- Include 45-minute focus blocks with 10-minute breaks
- Mix subjects to prevent fatigue
- Start with hardest subjects when energy is highest
- Include 1 revision session
- Include 1 practice/mock session
- If student is stressed/burnt_out, reduce load by 30%
- End day with light review
- Only use subjects from the student's exam: ${subjectList}

Return JSON array of tasks:
[{
  "title": "task title",
  "description": "brief description of what to do",
  "type": "study|revision|practice|mock_test|break|review",
  "subject": "one of: ${subjectList}",
  "chapter": "chapter name or null",
  "priority": "critical|high|medium|low",
  "estimated_minutes": number,
  "scheduled_start_time": "HH:mm"
}]`;

  const tasks = await generateJSON<any[]>('flash',
    `You are an expert ${examType} exam planner. Create optimal, realistic study schedules.`, prompt);

  if (!tasks || tasks.length === 0) return [];

  // Save to database
  const rows = tasks.map(t => ({
    user_id: userId,
    title: t.title,
    description: t.description || '',
    type: t.type || 'study',
    subject: t.subject || null,
    chapter: t.chapter || null,
    priority: t.priority || 'medium',
    estimated_minutes: t.estimated_minutes || 45,
    scheduled_date: date,
    scheduled_start_time: t.scheduled_start_time || null,
    is_completed: false,
  }));

  const { data } = await supabase.from('study_tasks').insert(rows).select();
  return data || [];
}
