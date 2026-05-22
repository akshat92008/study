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
  targetDate: string,
  quizResults?: Array<{ chapter: string; concept: string; isCorrect: boolean }>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const userId = user.id;

  const targetYear = new Date(targetDate).getFullYear();

  // 1. Save Profile
  const { data: profile } = await supabase.from('profiles').select('id').eq('id', userId).single();
  if (!profile) {
    await supabase.from('profiles').insert({
      id: userId, full_name: user.user_metadata?.full_name || 'Student', email: user.email || '',
      exam_type: examType, target_year: targetYear, exam_date: targetDate,
      onboarding_complete: true, updated_at: new Date().toISOString(),
    });
  } else {
    await supabase.from('profiles').update({
      exam_type: examType, target_year: targetYear, exam_date: targetDate,
      onboarding_complete: true, updated_at: new Date().toISOString(),
    }).eq('id', userId);
  }

  // 2. Seed Basic ATLAS Knowledge Graph
  const { seedConceptsForSubject } = await import('@/lib/engines/cognition-graph');
  const { getExamConfig } = await import('@/lib/utils/constants');
  
  const config = getExamConfig(examType);
  let totalSeeded = 0;
  for (const subject of config.subjects) {
    const chapters = config.chapters[subject] || ['Foundations', 'Core Concepts', 'Advanced Applications'];
    if (chapters.length > 0) {
      const result = await seedConceptsForSubject(userId, subject, chapters);
      totalSeeded += result.seeded || 0;
    }
  }

  // 3. Apply Diagnostic Quiz Results to Graph (The Magic Moment Data)
  if (quizResults && quizResults.length > 0) {
    const { resolveConceptByName } = await import('@/lib/engines/concept-resolver');
    for (const result of quizResults) {
      const conceptId = await resolveConceptByName(userId, config.subjects[0] || 'General', result.chapter);
      if (conceptId) {
        // Correct = Proficient (Green), Incorrect = Exposed (Red)
        await supabase.from('concepts').update({
          mastery: result.isCorrect ? 'proficient' : 'exposed',
          confidence: result.isCorrect ? 'high' : 'low'
        }).eq('id', conceptId);
      }
    }
  }
  
  // 4. Generate Day 1 Plan
  const { generateDay1Plan } = await import('@/lib/actions/onboarding'); // self import for helper
  const { tasksCreated } = await generateDay1Plan(userId, examType);

  // 5. Auto-Generate First Flashcards (Max 20 concepts, 3 cards each)
  let cardsCreated = 0;
  try {
    const { data: priorityConcepts } = await supabase.from('concepts')
      .select('id, subject, chapter').eq('user_id', userId)
      .in('mastery', ['exposed', 'not_started']).order('mastery', { ascending: true }).limit(20);

    if (priorityConcepts && priorityConcepts.length > 0) {
      const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');
      const results = await Promise.allSettled(
        priorityConcepts.map(c => generateCardsForConcept(userId, c.id, c.subject, c.chapter, 3))
      );
      results.forEach(res => { if (res.status === 'fulfilled' && res.value) cardsCreated += res.value.length; });
    }
  } catch (e) { console.error('Auto-card generation failed:', e); }

  return { seeded: totalSeeded, tasksCreated, cardsCreated };
}
