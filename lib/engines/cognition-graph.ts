import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/gemini';
import { logger } from '@/lib/utils/logger';
import { expandChapterWithAI } from './atlas-expansion';

const MASTERY_WEIGHTS: Record<string, number> = {
  not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
};

function getMasteryLevel(score: number): 'not_started' | 'exposed' | 'developing' | 'proficient' | 'mastered' | 'automated' {
  if (score >= 95) return 'automated';
  if (score >= 85) return 'mastered';
  if (score >= 60) return 'proficient';
  if (score >= 25) return 'developing';
  if (score > 0) return 'exposed';
  return 'not_started';
}



export async function getCognitionGraph(userId: string) {
  const supabase = await createClient();

  const [conceptsRes, linksRes] = await Promise.all([
    supabase.from('concepts').select('*').eq('user_id', userId).order('subject', { ascending: true }),
    supabase.from('concept_links').select('*').eq('user_id', userId)
  ]);

  const concepts = conceptsRes.data || [];
  const links = linksRes.data || [];

  const grouped: Record<string, Record<string, Record<string, any[]>>> = {};

  const { data: cards } = await supabase.from('revision_cards').select('concept_id, stability').eq('user_id', userId);
  const stabilityMap: Record<string, number> = {};
  if (cards) {
    cards.forEach(c => {
      if (c.concept_id && c.stability > 0) stabilityMap[c.concept_id] = c.stability;
    });
  }
  
  concepts.forEach((c: any) => {
    if (!grouped[c.subject]) grouped[c.subject] = {};
    if (!grouped[c.subject][c.chapter]) grouped[c.subject][c.chapter] = {};
    
    const topic = c.topic || 'General';
    if (!grouped[c.subject][c.chapter][topic]) grouped[c.subject][c.chapter][topic] = [];
    
    if (c.last_reviewed_at) {
      const daysElapsed = (Date.now() - new Date(c.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24);
      const stability = stabilityMap[c.id];
      
      if (stability) {
        const retention = Math.exp(Math.log(0.9) * daysElapsed / stability);
        c.live_forgetting_probability = Math.min(0.99, Math.max(0, 1 - retention));
      } else {
        c.live_forgetting_probability = Math.min(0.99, Math.max(0, 1 - (c.retention_strength * Math.exp(-0.1 * daysElapsed))));
      }
    } else {
      c.live_forgetting_probability = 1.0;
    }

    grouped[c.subject][c.chapter][topic].push(c);
  });

  const total = concepts.length;
  const mastered = concepts.filter((c: any) => c.mastery === 'mastered' || c.mastery === 'automated').length;
  const developing = concepts.filter((c: any) => c.mastery === 'developing').length;
  const weak = concepts.filter((c: any) => c.mastery === 'exposed' || c.mastery === 'not_started').length;
  
  let overallMastery = 0;
  if (total > 0) {
    const sum = concepts.reduce((acc: number, c: any) => acc + (MASTERY_WEIGHTS[c.mastery] || 0), 0);
    overallMastery = Math.round(sum / total);
  }

  const stats = { total, mastered, developing, weak, overallMastery };

  const weakClusters: Array<{ subject: string, chapter: string, mastery: number }> = [];
  for (const subject in grouped) {
    for (const chapter in grouped[subject]) {
      let chapterSum = 0;
      let chapterTotal = 0;
      for (const topic in grouped[subject][chapter]) {
        grouped[subject][chapter][topic].forEach(c => {
          chapterSum += MASTERY_WEIGHTS[c.mastery] || 0;
          chapterTotal++;
        });
      }
      const avg = chapterTotal > 0 ? chapterSum / chapterTotal : 0;
      if (avg < 40) {
        weakClusters.push({ subject, chapter, mastery: Math.round(avg) });
      }
    }
  }

  return { concepts: concepts || [], links: links || [], grouped, stats, weakClusters };
}

export async function seedConceptsForSubject(userId: string, subject: string, chapters: string[]) {
  const supabase = await createClient();
  
  // Get exam type from profile
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  // Get active goal ID if any
  const { data: activeGoal } = await supabase.from('learning_goals').select('id').eq('user_id', userId).eq('status', 'active').limit(1).maybeSingle();
  const goalId = activeGoal?.id || null;

  let seededCount = 0;

  for (const chapter of chapters) {
    try {
      // AI-generates 8-12 micro-concepts for the chapter
      const concepts = await expandChapterWithAI(userId, subject, chapter, examType);
      if (!concepts.length) continue;

      // Insert concepts
      const conceptRecords = concepts.map(c => ({
        user_id: userId,
        goal_id: goalId,
        name: c.name,
        description: c.description,
        subject,
        chapter,
        mastery: 'not_started' as const,
        confidence: 'low' as const,
        times_reviewed: 0,
        times_correct: 0,
        times_incorrect: 0,
        forgetting_probability: 1.0,
        retention_strength: 0.0,
      }));

      const { data: inserted, error: insertErr } = await supabase
        .from('concepts')
        .insert(conceptRecords)
        .select('id, name');

      if (insertErr || !inserted) {
        logger.error('Failed to insert concepts for chapter', { chapter, insertErr });
        continue;
      }

      // Build prerequisite links
      const nameToId: Record<string, string> = {};
      inserted.forEach(c => { nameToId[c.name] = c.id; });

      const links = concepts.flatMap(c => {
        const sourceId = nameToId[c.name];
        if (!sourceId) return [];
        return c.prerequisiteNames
          .map(prereqName => nameToId[prereqName])
          .filter(Boolean)
          .map(targetId => ({
            user_id: userId,
            source_concept_id: targetId, // prereq must be done first
            target_concept_id: sourceId,
            link_type: 'prerequisite',
            strength: 0.8
          }));
      });

      if (links.length > 0) {
        await supabase.from('concept_links').insert(links);
      }

      seededCount += inserted.length;
    } catch (err) {
      logger.error('Failed to seed chapter dynamically', { subject, chapter, err });
    }
  }

  return { seeded: seededCount };
}

export async function updateConceptState(conceptId: string, correct: boolean, timeSpent: number, weight: number = 1) {
  const supabase = await createClient();

  const { data: concept } = await supabase.from('concepts').select('*').eq('id', conceptId).single();
  if (!concept) return;

  const newReviewed = (concept.times_reviewed || 0) + (1 * weight);
  const newCorrect = (concept.times_correct || 0) + (correct ? (1 * weight) : 0);
  const newIncorrect = (concept.times_incorrect || 0) + (correct ? 0 : (1 * weight));
  const accuracy = newCorrect / newReviewed;

  const newMastery = getMasteryLevel(accuracy * 100);

  const now = new Date();
  const daysSinceReview = concept.last_reviewed_at
    ? (Date.now() - new Date(concept.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const retentionStrength = Math.min(1, accuracy * (newReviewed / 10));
  const forgettingProbability = Math.max(0, 1 - retentionStrength * Math.exp(-0.1 * daysSinceReview));

  await supabase.from('concepts').update({
    times_reviewed: newReviewed,
    times_correct: newCorrect,
    times_incorrect: newIncorrect,
    mastery: newMastery,
    confidence: accuracy >= 0.8 ? 'high' : accuracy >= 0.5 ? 'medium' : 'low',
    last_reviewed_at: now.toISOString(),
    retention_strength: retentionStrength,
    forgetting_probability: forgettingProbability,
    updated_at: now.toISOString(),
  }).eq('id', conceptId);

  const { data: inboundLinks } = await supabase.from('concept_links').select('*').eq('target_concept_id', conceptId);
  if (inboundLinks && inboundLinks.length > 0) {
    const linkUpdates = inboundLinks.map((l: any) => {
      const newStrength = correct ? Math.min(1.0, l.strength + 0.05) : Math.max(0.1, l.strength - 0.15);
      return supabase.from('concept_links').update({ strength: newStrength }).eq('id', l.id);
    });
    await Promise.all(linkUpdates);
  }
}

export async function updateConceptMastery(conceptId: string, correct: boolean, timeSpent: number) {
  return updateConceptState(conceptId, correct, timeSpent);
}

export async function analyzeCognitionState(userId: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  const { concepts, stats } = await getCognitionGraph(userId);
  if (concepts.length === 0) return null;

  const weakConcepts = concepts
    .filter((c: any) => c.mastery === 'not_started' || c.mastery === 'exposed')
    .map((c: any) => `${c.subject}: ${c.chapter}`)
    .slice(0, 10);

  const prompt = `Analyze this student's knowledge state and provide strategic insights:
Exam: ${examType}
Overall Mastery: ${stats.overallMastery}%
Weak areas: ${weakConcepts.join(', ')}

Respond as JSON: { "summary": "assessment", "topPriority": "focus", "strengths": ["s1"], "criticalGaps": ["g1"], "recommendation": "advice" }`;

  return generateJSON('flash', `You are an expert ${examType} exam strategist.`, prompt);
}

export async function expandChapterViaMind(userId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  try {
    const concepts = await expandChapterWithAI(userId, subject, chapter, examType);
    const insertedConcepts = [];

    // Insert new granular concepts
    for (const concept of concepts) {
      const { data } = await supabase.from('concepts').insert({
        user_id: userId, 
        name: concept.name, 
        description: concept.description,
        subject, 
        chapter, 
        topic: 'General', 
        mastery: 'not_started', 
        confidence: 'low',
      }).select().single();
      
      if (data) {
        insertedConcepts.push({ dbData: data, prereqs: concept.prerequisiteNames || [] });
      }
    }

    // Resolve and link prerequisites
    const { resolveConceptByName } = await import('./concept-resolver');
    for (const item of insertedConcepts) {
      for (const prereq of item.prereqs) {
        const sourceId = await resolveConceptByName(userId, subject, prereq);
        if (sourceId && sourceId !== item.dbData.id) {
          await supabase.from('concept_links').insert({
            user_id: userId, 
            source_concept_id: sourceId, 
            target_concept_id: item.dbData.id, 
            link_type: 'prerequisite', 
            strength: 0.8,
          });
        }
      }
    }
    return insertedConcepts.map(ic => ic.dbData);
  } catch (error) {
    logger.error('Failed to dynamically expand chapter via mind', error);
    return [];
  }
}

export async function getPrerequisiteChain(conceptId: string) {
  const supabase = await createClient();
  const { data: links } = await supabase.from('concept_links').select('source_concept_id').eq('target_concept_id', conceptId).eq('link_type', 'prerequisite');
  if (!links || links.length === 0) return [];
  const sourceIds = links.map((l: any) => l.source_concept_id);
  const { data: concepts } = await supabase.from('concepts').select('name, mastery').in('id', sourceIds);
  return (concepts || []).filter((c: any) => ['not_started', 'exposed', 'developing'].includes(c.mastery));
}

// ------------------------------------------------------------------
// CONSUMERS
// ------------------------------------------------------------------
export class AtlasConsumer {
  static async handleAutopsyProcessed(userId: string, metadata: any) {
    const autopsyId = metadata?.autopsyId || metadata?.mockId;
    if (!autopsyId) return;

    const supabase = await createClient();
    const { data: questions } = await supabase
      .from('autopsy_questions')
      .select('subject, chapter, mistake_category, marks_lost')
      .eq('autopsy_id', autopsyId)
      .eq('status', 'Incorrect');

    if (!questions || questions.length === 0) return;
    
    // Lazy load concept resolver to avoid circular dependency
    const { resolveConceptByName } = await import('./concept-resolver');

    // Run concurrently with a batch limit
    const batchSize = 5;
    for (let i = 0; i < questions.length; i += batchSize) {
      const batch = questions.slice(i, i + batchSize);
      await Promise.all(batch.map(async (q: any) => {
        // Only downscale mastery for conceptual or incomplete knowledge errors
        if (!['conceptual', 'incomplete_knowledge'].includes(q.mistake_category)) {
          return;
        }

        try {
          const conceptId = await resolveConceptByName(userId, q.subject, q.chapter);
          if (conceptId) {
            // Downscale mastery relative to marks lost (pass weight)
            await updateConceptState(conceptId, false, 0, Math.max(1, q.marks_lost));
            logger.info('ATLAS: Downscaled mastery due to AUTOPSY error', { conceptId, category: q.mistake_category });
          }
        } catch (err) {
          logger.error('ATLAS: Failed to map concept from autopsy', err);
        }
      }));
    }
  }
}
