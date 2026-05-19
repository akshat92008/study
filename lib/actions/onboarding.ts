'use server';

import { createClient } from '@/lib/supabase/server';
import { getExamConfig } from '@/lib/utils/constants';

export async function seedKnowledgeGraph(
  userId: string,
  examType: string,
  weakSpots: Record<string, string[]>
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

  for (const [subject, weakChapters] of Object.entries(weakSpots)) {
    if (weakChapters.length > 0) {
      const query = supabase
        .from('concepts')
        .update({ mastery: 'exposed', confidence: 'very_low' })
        .eq('user_id', userId)
        .in('chapter', weakChapters);

      if (subject !== 'General') {
        query.eq('subject', subject);
      }
      await query;
    }
  }

  return { seeded: totalSeeded };
}

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
        notes: "AI prioritized based on your onboarding weak-spot analysis."
      });
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
    notes: "Mandatory cognitive down-regulation."
  });

  if (tasks.length > 0) {
    await supabase.from('study_tasks').insert(tasks);
  }

  return { tasksCreated: tasks.length, tasks };
}

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

  // Ensure profile exists (defensive fallback for trigger race conditions or missing profiles)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single();

  if (!profile) {
    await supabase.from('profiles').insert({
      id: userId,
      full_name: user.user_metadata?.full_name || 'Student',
      email: user.email || '',
      exam_type: examType,
      target_year: targetYear,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    });
  } else {
    // 1. Save Profile
    await supabase.from('profiles').update({
      exam_type: examType,
      target_year: targetYear,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }).eq('id', userId);
  }

  // 2. Seed ATLAS Knowledge Graph
  const { seeded } = await seedKnowledgeGraph(userId, examType, weakSpots);
  
  // 3. Generate Day 1 Plan
  const { tasksCreated } = await generateDay1Plan(userId, examType);

  // 4. Auto-generate Flashcards from Weak Spots
  let cardsCreated = 0;
  try {
    const { data: priorityConcepts } = await supabase
      .from('concepts')
      .select('id, subject, chapter')
      .eq('user_id', userId)
      .eq('mastery', 'exposed') 
      .limit(3); 

    if (priorityConcepts && priorityConcepts.length > 0) {
      const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
      
      // Generate cards concurrently for the top 3 weak chapters
      const results = await Promise.allSettled(
        priorityConcepts.map(c => generateCardsForConcept(userId, c.id, c.subject, c.chapter))
      );
      results.forEach(res => {
        if (res.status === 'fulfilled' && res.value) {
          cardsCreated += res.value.length;
        }
      });
    }
  } catch (e) {
    console.error('Auto-card generation during onboarding failed:', e);
  }

  return { seeded, tasksCreated, cardsCreated };
}
