'use server';

import { createClient } from '@/lib/supabase/server';
import { getExamConfig } from '@/lib/utils/constants';
import { logger } from '@/lib/utils/logger';

export async function seedKnowledgeGraph(
  userId: string,
  examType: string,
  weakSpots: Record<string, string[]>
) {
  const supabase = await createClient();
  const config = getExamConfig(examType);
  const { queueConceptSeedingForSubject } = await import('@/lib/engines/cognition-graph');

  let totalSeeded = 0;
  for (const subject of config.subjects) {
    const chapters = config.chapters[subject] || [];
    if (chapters.length > 0) {
      const result = await queueConceptSeedingForSubject(userId, subject, chapters);
      totalSeeded += result.queued || 0;
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

  return { status: 'queued', seeded: totalSeeded };
}

export async function seedOnboardingKnowledgeMap(
  userId: string,
  examType: string,
  preferredSubjects: string[] = []
): Promise<{ skeletonCreated: number; expansionQueued: number }> {
  const supabase = await createClient();
  const config = getExamConfig(examType);
  const { queueConceptSeedingForSubject } = await import('@/lib/engines/cognition-graph');

  const subjects = preferredSubjects.length > 0
    ? preferredSubjects
    : config.subjects;

  let skeletonCreated = 0;
  let expansionQueued = 0;

  for (const subject of subjects) {
    const chapters = config.chapters[subject]?.length
      ? config.chapters[subject]
      : ['Foundations'];

    const { data: existing } = await supabase
      .from('concepts')
      .select('chapter')
      .eq('user_id', userId)
      .eq('subject', subject);

    const existingChapters = new Set((existing || []).map((row: any) => String(row.chapter).toLowerCase()));
    const rows = chapters
      .filter((chapter) => !existingChapters.has(chapter.toLowerCase()))
      .map((chapter) => ({
        user_id: userId,
        name: chapter,
        description: `${examType} onboarding syllabus anchor for ${subject}: ${chapter}`,
        subject,
        chapter,
        topic: 'Onboarding',
        mastery: 'not_started' as const,
        confidence: 'low' as const,
        forgetting_probability: 1.0,
        retention_strength: 0.0,
        version: 1,
      }));

    if (rows.length > 0) {
      const { data, error } = await supabase
        .from('concepts')
        .insert(rows)
        .select('id');
      if (error) {
        logger.warn('seedOnboardingKnowledgeMap: skeleton insert failed', { userId, subject, error: error.message });
      } else {
        skeletonCreated += data?.length || rows.length;
      }
    }

    const queued = await queueConceptSeedingForSubject(userId, subject, chapters)
      .catch((err) => {
        logger.warn('seedOnboardingKnowledgeMap: expansion queue failed', { userId, subject, err });
        return { queued: 0 };
      });
    expansionQueued += queued.queued || 0;
  }

  return { skeletonCreated, expansionQueued };
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', user.id)
    .single();

  if (!profile) {
    await supabase.from('profiles').insert({
      id: user.id,
      full_name: user.user_metadata?.full_name || 'Student',
      email: user.email || '',
      exam_type: examType,
      target_date: targetDate,
      onboarding_complete: false,
      updated_at: new Date().toISOString(),
    });
  } else {
    await supabase.from('profiles').update({
      exam_type: examType,
      target_date: targetDate,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id);
  }

  // Save quiz results to the durable event queue so workers can process them.
  if (quizResults && quizResults.length > 0) {
    const { EventDispatcher } = await import('@/lib/events/orchestrator');
    await EventDispatcher.publish({
      user_id: user.id,
      type: 'ONBOARDING_QUIZ_COMPLETE',
      data: { quizResults, examType },
      metadata: { source: 'onboarding' },
      idempotency_key: `onboarding:${user.id}:${targetDate}`,
    });
  }

  return { saved: true };
}

export async function seedInitialCards(
  userId: string,
  options: { maxConcepts?: number; cardsPerConcept?: number } = {}
): Promise<{ cardsCreated: number }> {
  const supabase = await createClient();
  const maxConcepts = Math.max(1, Math.min(options.maxConcepts ?? 20, 20));
  const cardsPerConcept = Math.max(1, Math.min(options.cardsPerConcept ?? 3, 5));

  try {
    // Check if cards are already generated for this user to prevent duplication
    const { count, error: countErr } = await supabase
      .from('revision_cards')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (countErr) {
      logger.error('seedInitialCards: failed to count existing cards', countErr);
    }

    if (count && count > 0) {
      logger.info('seedInitialCards: user already has cards, skipping seeding', { userId, count });
      return { cardsCreated: 0 };
    }

    // Fetch concepts seeded during onboarding - prioritize not_started and exposed
    const { data: concepts, error } = await supabase
      .from('concepts')
      .select('id, name, subject, chapter, mastery')
      .eq('user_id', userId)
      .in('mastery', ['not_started', 'exposed', 'developing'])
      .order('created_at', { ascending: true })
      .limit(maxConcepts);

    if (error || !concepts || concepts.length === 0) {
      logger.warn('seedInitialCards: no concepts found for user', { userId });
      return { cardsCreated: 0 };
    }

    const { generateCardsForConcept } = await import('@/lib/engines/revision-engine');

    // Fire card generation for each concept concurrently
    // allSettled so one failure doesn't block others
    const results = await Promise.allSettled(
      concepts.map(concept =>
        generateCardsForConcept(userId, concept.id, concept.subject, concept.chapter, cardsPerConcept)
          .then(cards => ({ created: Array.isArray(cards) ? cards.length : 0 }))
          .catch(err => {
            logger.warn('Card gen failed for concept', { conceptId: concept.id, err: err.message });
            return { created: 0 };
          })
      )
    );

    const totalCreated = results.reduce((sum, r) => {
      if (r.status === 'fulfilled') return sum + (r.value?.created || 0);
      return sum;
    }, 0);

    logger.info('seedInitialCards complete', { userId, totalCreated });
    return { cardsCreated: totalCreated };

  } catch (err: any) {
    logger.error('seedInitialCards failed', err);
    return { cardsCreated: 0 };
  }
}
