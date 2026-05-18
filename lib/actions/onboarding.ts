'use server';

import { createClient } from '@/lib/supabase/server';
import { getExamConfig } from '@/lib/utils/constants';

// Seed the knowledge graph with exam chapters based on self-assessment
export async function seedKnowledgeGraph(
  userId: string,
  examType: string,
  weakSpots: Record<string, string[]> // { "Physics": ["Optics", "Thermodynamics"], ... }
) {
  const supabase = await createClient();
  const config = getExamConfig(examType);
  const conceptRows: any[] = [];

  for (const subject of config.subjects) {
    const chapters = config.chapters[subject] || [];
    for (const chapter of chapters) {
      const isWeak = weakSpots[subject]?.includes(chapter);
      conceptRows.push({
        user_id: userId,
        name: chapter,
        subject,
        chapter,
        topic: '',
        mastery: isWeak ? 'exposed' : 'not_started',
        confidence: isWeak ? 'very_low' : 'low',
      });
    }
  }

  if (conceptRows.length > 0) {
    for (let i = 0; i < conceptRows.length; i += 50) {
      const chunk = conceptRows.slice(i, i + 50);
      await supabase.from('concepts').insert(chunk);
    }
  }

  return { seeded: conceptRows.length };
}

// Generate the Day 1 plan immediately after onboarding
export async function generateDay1Plan(userId: string, examType: string) {
  const supabase = await createClient();

  const { data: weakConcepts } = await supabase
    .from('concepts')
    .select('subject, chapter, mastery')
    .eq('user_id', userId)
    .eq('mastery', 'exposed')
    .limit(3);

  const tasks: any[] = [];
  const today = new Date().toISOString();

  if (weakConcepts && weakConcepts.length > 0) {
    weakConcepts.forEach((concept: any, i: number) => {
      tasks.push({
        user_id: userId,
        title: `Deep dive: ${concept.chapter}`,
        description: `Focus revision on your weak chapter in ${concept.subject}`,
        type: 'study',
        subject: concept.subject,
        chapter: concept.chapter,
        priority: i === 0 ? 'critical' : 'high',
        estimated_minutes: 45,
        scheduled_date: today,
      });
    });
  }

  const { data: strongConcepts } = await supabase
    .from('concepts')
    .select('subject, chapter')
    .eq('user_id', userId)
    .eq('mastery', 'not_started')
    .limit(1);

  if (strongConcepts && strongConcepts.length > 0) {
    tasks.push({
      user_id: userId,
      title: `Start new chapter: ${strongConcepts[0].chapter}`,
      description: `Begin ${strongConcepts[0].subject} exploration`,
      type: 'study',
      subject: strongConcepts[0].subject,
      chapter: strongConcepts[0].chapter,
      priority: 'medium',
      estimated_minutes: 30,
      scheduled_date: today,
    });
  }

  tasks.push({
    user_id: userId,
    title: 'Strategic break — walk, hydrate, reset',
    description: 'Your brain needs recovery between intense sessions',
    type: 'break',
    priority: 'medium',
    estimated_minutes: 15,
    scheduled_date: today,
  });

  if (tasks.length > 0) {
    await supabase.from('study_tasks').insert(tasks);
  }

  return { tasksCreated: tasks.length, tasks };
}

// Complete onboarding — mark profile and trigger graph + plan
// Note: userId param is ignored; we resolve from the session for security
export async function completeOnboarding(
  _userId: string,
  examType: string,
  targetYear: number,
  weakSpots: Record<string, string[]>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const userId = user.id;

  await supabase.from('profiles').update({
    exam_type: examType,
    target_year: targetYear,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  const { seeded } = await seedKnowledgeGraph(userId, examType, weakSpots);
  const { tasksCreated } = await generateDay1Plan(userId, examType);

  return { seeded, tasksCreated };
}

