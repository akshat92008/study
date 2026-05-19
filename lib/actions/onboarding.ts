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
  const { seedConceptsForSubject } = await import('@/lib/engines/cognition-graph');

  let totalSeeded = 0;
  for (const subject of config.subjects) {
    const chapters = config.chapters[subject] || [];
    if (chapters.length > 0) {
      const result = await seedConceptsForSubject(userId, subject, chapters);
      totalSeeded += result.seeded || 0;
    }
  }

  // Update mastery for identified weak spots
  for (const [subject, weakChapters] of Object.entries(weakSpots)) {
    if (weakChapters.length > 0) {
      await supabase
        .from('concepts')
        .update({ mastery: 'exposed', confidence: 'very_low' })
        .eq('user_id', userId)
        .eq('subject', subject)
        .in('chapter', weakChapters);
    }
  }

  return { seeded: totalSeeded };
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

  // Auto-generate revision cards for the first batch of seeded concepts
  try {
    const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, subject, chapter')
      .eq('user_id', userId)
      .limit(10); // Cap initial generation to avoid timeout

    if (concepts && concepts.length > 0) {
      // Generate cards concurrently for speed (batches of 3 to respect rate limits)
      for (let i = 0; i < concepts.length; i += 3) {
        const batch = concepts.slice(i, i + 3);
        await Promise.allSettled(
          batch.map(c => generateCardsForConcept(userId, c.id, c.subject, c.chapter))
        );
      }
    }
  } catch (e) {
    // Non-critical — onboarding succeeds even if card gen fails
    console.error('Auto-card generation during onboarding failed:', e);
  }

  return { seeded, tasksCreated };
}

