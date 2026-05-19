'use server';

import { createClient } from '@/lib/supabase/server';
import { getExamConfig } from '@/lib/utils/constants';
import { logger } from '@/lib/utils/logger';

// Seed the knowledge graph with exam chapters based on self-assessment
export async function seedKnowledgeGraph(userId: string, examType: string, weakSpots: Record<string, string[]>) {
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

  // Update mastery for identified weak spots to "exposed"
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
export async function generateDay1Plan(userId: string) {
  const supabase = await createClient();
  const today = new Date().toISOString();
  
  // Trigger the actual AI planner to build a realistic Day 1
  const { generateDailyPlan } = await import('@/lib/ai/agents/planner');
  const tasks = await generateDailyPlan(userId, today.split('T')[0]);

  return { tasksCreated: tasks.length, tasks };
}

// Complete onboarding — mark profile and trigger graph + plan + auto-cards
export async function completeOnboarding(
  _userId: string, // Ignored, fetched securely below
  examType: string,
  targetYear: number,
  weakSpots: Record<string, string[]>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const userId = user.id;

  // 1. Update Profile
  await supabase.from('profiles').update({
    exam_type: examType,
    target_year: targetYear,
    onboarding_complete: true,
    updated_at: new Date().toISOString(),
  }).eq('id', userId);

  // 2. Seed Graph & Plan
  const { seeded } = await seedKnowledgeGraph(userId, examType, weakSpots);
  const { tasksCreated } = await generateDay1Plan(userId);

  // 3. Auto-generate revision cards from the materials they JUST uploaded
  let cardsCreated = 0;
  try {
    const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
    
    // Pick 3 concepts (prioritizing their weak spots) to generate the first deck
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, subject, chapter')
      .eq('user_id', userId)
      .order('forgetting_probability', { ascending: false })
      .limit(3); 

    if (concepts && concepts.length > 0) {
      for (const c of concepts) {
        const generated = await generateCardsForConcept(userId, c.id, c.subject, c.chapter);
        if (generated) cardsCreated += generated.length;
      }
    }
  } catch (e) {
    logger.error('Auto-card generation during onboarding failed:', e);
  }

  return { seeded, tasksCreated, cardsCreated };
}
