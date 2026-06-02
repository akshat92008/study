import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateJSON } from '@/lib/ai/provider-client';
import { logger } from '@/lib/utils/logger';
import { expandChapterWithAI } from './atlas-expansion';
import { applyMasteryUpdate, recordMasteryEvidence } from '@/lib/engines/mastery-updater';
import { invalidateSessionCards } from '@/lib/services/session-card-cache';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { isVerifiedAutopsyMistake } from '@/lib/events/autopsy-evidence';


export const MASTERY_WEIGHTS: Record<string, number> = {
  not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
};

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
  // Deduplicate to chapter level before computing mastery %
  const chapterBestMap = new Map<string, number>();
  for (const c of concepts) {
    const key = `${c.subject}::${c.chapter}`;
    const current = MASTERY_WEIGHTS[c.mastery] || 0;
    if (!chapterBestMap.has(key) || current > chapterBestMap.get(key)!) {
      chapterBestMap.set(key, current);
    }
  }
  const chapterValues = Array.from(chapterBestMap.values());
  const chapterTotal = chapterValues.length;
  const sum = chapterValues.reduce((acc, v) => acc + v, 0);
  overallMastery = chapterTotal > 0 ? Math.round(sum / chapterTotal) : 0;

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

      // Deduplicate against existing concepts
      const { data: existingConcepts } = await supabase
        .from('concepts')
        .select('name')
        .eq('user_id', userId)
        .eq('subject', subject)
        .eq('chapter', chapter);
      
      const existingNames = new Set((existingConcepts || []).map(c => c.name.toLowerCase()));
      const filteredConcepts = concepts.filter(c => !existingNames.has(c.name.toLowerCase()));

      if (filteredConcepts.length === 0) continue;

      // Insert concepts
      const conceptRecords = filteredConcepts.map(c => ({
        user_id: userId,
        goal_id: goalId,
        name: c.name,
        description: c.description,
        subject,
        chapter,
        topic: c.name, // Using name as topic or 'General'
        mastery: 'not_started' as const,
        confidence: 'low' as const,
        times_reviewed: 0,
        times_correct: 0,
        times_incorrect: 0,
        forgetting_probability: 1.0,
        retention_strength: 0.0,
        version: 1,
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

export async function queueConceptSeedingForSubject(userId: string, subject: string, chapters: string[]) {
  const { EventDispatcher } = await import('@/lib/events/orchestrator');
  const uniqueChapters = Array.from(new Set(chapters.filter(Boolean)));
  const results = await Promise.allSettled(
    uniqueChapters.map((chapter) =>
      EventDispatcher.publish({
        user_id: userId,
        type: 'CONCEPT_DISCOVERED',
        data: {
          subject,
          chapter,
          topic: chapter,
        },
        metadata: { source: 'concept_seeding_queue' },
        idempotency_key: `concept_seed:${userId}:${subject}:${chapter}`,
      })
    )
  );

  return {
    status: 'queued',
    queued: results.filter((result) => result.status === 'fulfilled').length,
    failed: results.filter((result) => result.status === 'rejected').length,
  };
}

export async function updateConceptState(conceptId: string, correct: boolean, timeSpent: number, weight: number = 1) {
  const supabase = await createClient();

  const { data: concept } = await supabase.from('concepts').select('*').eq('id', conceptId).single();
  if (!concept) return;

  // Scale mastery updates based on time spent. 
  // Minimum weight of 1, max of 3 for deep sessions (e.g. > 3 minutes)
  const effectiveWeight = (weight === 1 && timeSpent > 0) 
    ? Math.min(3, Math.max(1, timeSpent / 60)) 
    : weight;

  const newReviewed = (concept.times_reviewed || 0) + (1 * effectiveWeight);
  const newCorrect = (concept.times_correct || 0) + (correct ? (1 * effectiveWeight) : 0);
  const newIncorrect = (concept.times_incorrect || 0) + (correct ? 0 : (1 * effectiveWeight));
  const accuracy = newCorrect / newReviewed;

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

  await recordMasteryEvidence({
    userId: concept.user_id,
    conceptId,
    evidenceType: correct ? 'practice_correct' : 'practice_wrong',
    source: 'practice',
    sourceId: `practice:${conceptId}:${correct ? 'correct' : 'wrong'}:${timeSpent}`,
    evidence: `Practice signal; accuracy ${(accuracy * 100).toFixed(0)}%, time spent ${timeSpent}s`,
  });
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

  const { budgetedGenerateJSON } = await import('@/lib/ai/budgeted');
  return budgetedGenerateJSON({
    userId,
    feature: 'atlas',
    route: 'atlas:cognition-analysis',
    model: 'flash',
    systemPrompt: `You are an expert ${examType} exam strategist.`,
    userPrompt: prompt,
    maxOutputTokens: 500
  });

export async function expandChapterViaMind(userId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const { data: profile } = await supabase.from('profiles').select('exam_type').eq('id', userId).single();
  const examType = profile?.exam_type || 'General';

  try {
    const concepts = await expandChapterWithAI(userId, subject, chapter, examType);
    const insertedConcepts: Array<{ dbData: any; prereqs: string[] }> = [];

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
  static async handleAutopsyProcessed(userId: string, metadata: any): Promise<void> {
    const wrongQuestions: Array<{
      subject: string;
      chapter: string;
      mistakeCategory: string | null;
      status?: string;
      extractionConfidence?: number;
      extraction_confidence?: number;
      needsReview?: boolean;
      needs_review?: boolean;
    }> = metadata?.wrongQuestions || [];

    if (wrongQuestions.length === 0) return;

    const supabase = createAdminClient();

    // Group by chapter to avoid redundant updates
    const chapterMap = new Map<string, { subject: string; chapter: string; count: number }>();
    for (const q of wrongQuestions) {
      if (!isVerifiedAutopsyMistake(q)) continue;
      if (!q.chapter || !q.subject) continue;
      const key = `${q.subject}::${q.chapter}`;
      const existing = chapterMap.get(key);
      if (existing) {
        existing.count++;
      } else {
        chapterMap.set(key, { subject: q.subject, chapter: q.chapter, count: 1 });
      }
    }

    // OVERWHELMED GATE: Cap the number of downgrades per autopsy to 3
    // to prevent cascading failure in user motivation and task spam.
    let downgradeCount = 0;
    const MAX_DOWNGRADES = 3;

    for (const { subject, chapter, count } of chapterMap.values()) {
      if (downgradeCount >= MAX_DOWNGRADES) {
        logger.warn(`AtlasConsumer: Overwhelmed gate triggered. Skipping remaining downgrades for user ${userId}`);
        break;
      }

      const resolution = await resolveConcept({
        userId,
        subject,
        chapter,
        topic: chapter,
        sourceType: 'autopsy',
        confidence: 0.8,
        client: supabase,
      });

      if (!resolution.conceptId) continue;

      const { data: concept } = await supabase
        .from('concepts')
        .select('id, mastery')
        .eq('id', resolution.conceptId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!concept) continue;

      const downgradedMastery = downgradeMastery(concept.mastery, count);
      if (downgradedMastery !== concept.mastery) {
        await applyMasteryUpdate({
          userId,
          conceptId: concept.id,
          newMastery: downgradedMastery as any,
          source: 'autopsy',
          sourceId: metadata?.autopsyId ?? undefined,
          sourceEventId: metadata?.eventId ?? metadata?.sourceEventId ?? undefined,
          evidence: `${count} wrong answer(s) in ${chapter} (${subject})`,
          useAdminClient: true,
        });
        downgradeCount++;
      }
    }

    logger.info(`AtlasConsumer: downscaled mastery for ${chapterMap.size} chapters`, { userId });
  }

  static async handleStudySessionCompleted(userId: string, data: any): Promise<void> {
    const { subject, chapter, durationMinutes = 10, history, latestMessage, latestResponse, intent, isSessionComplete, masteryEvidenceRecorded } = data || {};
    if (!subject || !chapter) return;
    if (masteryEvidenceRecorded) {
      logger.info('AtlasConsumer: session mastery evidence already recorded by canonical completion service', { userId, subject, chapter });
      return;
    }

    const supabase = createAdminClient();

    let understood = false;

    // AI Analysis for actual understanding if session completed
    if (isSessionComplete && history && latestResponse) {
      try {
        const historySnippet = history.map((m: any) => `${m.role === 'user' ? 'Student' : 'Tutor'}: ${m.content.slice(0, 200)}`).join('\n');
        const isPractice = intent === 'PRACTICE';
        const analysisPrompt = isPractice
          ? `Analyze this practice interaction.\n${historySnippet}\nStudent Answer: ${latestMessage}\nAI Feedback: ${latestResponse.slice(0, 800)}\n\nDid the student answer correctly? Respond ONLY as JSON:\n{"summary":"1 sentence","understood":true}`
          : `Analyze this tutor exchange.\n${historySnippet}\nStudent: ${latestMessage}\nTutor: ${latestResponse.slice(0, 800)}\n\nRespond ONLY as JSON:\n{"summary":"1 sentence","understood":true}`;
        
        const { budgetedGenerateJSON } = await import('@/lib/ai/budgeted');
        const raw = await budgetedGenerateJSON<any>({
          userId,
          feature: 'atlas',
          route: 'atlas:session-analysis',
          model: 'flash',
          systemPrompt: 'Expert analyzer. Return JSON only.',
          userPrompt: analysisPrompt,
          maxOutputTokens: 500
        });
        if (raw && typeof raw.understood === 'boolean') {
          understood = raw.understood;
        }
      } catch (err) {
        logger.warn('Async session analysis failed', err);
      }
    }

    const resolution = await resolveConcept({
      userId,
      subject,
      chapter,
      topic: chapter,
      sourceType: 'session',
      confidence: data?.conceptId ? 1 : 0.94,
      client: supabase,
    });

    if (!resolution.conceptId) return;

    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, mastery')
      .eq('user_id', userId)
      .eq('id', resolution.conceptId);

    if (!concepts || concepts.length === 0) return;

    for (const concept of concepts) {
      // If completed, use actual understood signal. If not, fallback to small duration upgrade.
      const upgradedMastery = isSessionComplete 
        ? (understood ? upgradeMastery(concept.mastery, 30) : concept.mastery) 
        : upgradeMastery(concept.mastery, Math.min(10, durationMinutes));

      if (upgradedMastery !== concept.mastery) {
        await applyMasteryUpdate({
          userId,
          conceptId: concept.id,
          newMastery: upgradedMastery as any,
          source: 'tutor_session',
          sourceId: data?.sessionId ?? undefined,
          sourceEventId: data?.eventId ?? data?.sourceEventId ?? undefined,
          evidence: isSessionComplete ? `Session on ${chapter} (${subject}), understood: ${understood}` : `Session on ${chapter} (${subject}), ${durationMinutes} min`,
          useAdminClient: true,
        });
      }
    }

    logger.info(`AtlasConsumer: upgraded mastery for ${subject} / ${chapter}`, { userId });
  }

  static async handlePracticeAttempt(userId: string, data: any): Promise<void> {
    const { items = [], setType } = data || {};
    if (items.length === 0) return;

    // Time spent per item, default to ~15 seconds for MCQ, ~10s for flashcard
    const timeSpentPerItem = setType === 'mcq' ? 15 : 10;
    const supabase = createAdminClient();

    for (const item of items) {
      let conceptId = item.conceptId;
      if (!conceptId && item.practiceItemId && item.conceptName) {
        try {
          const { data: practiceItem } = await supabase
            .from('practice_items')
            .select('subject, chapter, topic, question')
            .eq('id', item.practiceItemId)
            .eq('user_id', userId)
            .maybeSingle();

          const resolution = await resolveConcept({
            userId,
            subject: practiceItem?.subject || null,
            chapter: practiceItem?.chapter || null,
            topic: item.conceptName,
            questionText: practiceItem?.question || null,
            sourceType: 'ingest',
            confidence: 0.93,
            client: supabase,
          });
          conceptId = resolution.conceptId;
        } catch (err) {
          logger.warn('AtlasConsumer: could not resolve practice concept by name', { userId, item, err });
        }
      }

      if (conceptId) {
        // For MCQ, we use isCorrect. For flashcard, we use confidence.
        // If confidence is 'knew' or 'easy', we count it as correct.
        let correct = false;
        if (setType === 'mcq') {
          correct = !!item.isCorrect;
        } else if (setType === 'flashcard') {
          correct = ['knew', 'easy'].includes(item.confidence);
        }

        await updateConceptState(conceptId, correct, timeSpentPerItem, 1);
      }
    }
    
    logger.info(`AtlasConsumer: processed practice attempt for ${items.length} items`, { userId, setType });
  }
}

// Helper: step mastery down the tier ladder
function downgradeMastery(
  current: string,
  wrongCount: number
): string {
  const tiers = ['not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated'];
  const idx = tiers.indexOf(current);
  if (idx <= 1) return 'exposed'; // Floor at 'exposed' — never go to not_started from autopsy
  const steps = Math.min(wrongCount, 2); // Max 2-tier drop per autopsy
  return tiers[Math.max(1, idx - steps)];
}

function upgradeMastery(current: string, durationMinutes: number): string {
  const tiers = ['not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated'];
  const idx = tiers.indexOf(current);
  if (idx < 0) return 'exposed';
  if (idx >= tiers.length - 1) return current; // Already automated

  // Only upgrade if meaningful time was spent
  // Short session (<10 min): max 1 tier. Longer (30+ min): up to 2 tiers.
  const steps = durationMinutes >= 30 ? Math.min(2, tiers.length - 1 - idx) : 1;
  return tiers[idx + steps];
}
