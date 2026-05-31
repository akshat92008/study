// lib/engines/mind-engine.ts
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { MINDContext } from '@/lib/ai/prompts/mind-prompt';
import { RAGEngine } from './rag-engine';
import { getLearnerStateSnapshot } from '@/lib/learner-state/getLearnerState';

type ConceptGraphRow = {
  id: string;
  name: string;
  chapter: string;
  subject: string;
  mastery: string;
};

export async function getMINDContext(userId: string, message?: string, topic?: string, subject?: string): Promise<MINDContext> {
  const startedAt = Date.now();
  try {
    logger.info('[MIND] context build started', { userId, feature: 'mind-context' });
    const supabase = await createClient();
    const learnerState = await getLearnerStateSnapshot(userId, { topic, subject, client: supabase });
    const rootGapChains = await getRootGapChains(userId, learnerState.atlas.weakConcepts);

    let ragChunks: { content: string; similarity: number; sourceTitle: string }[] = [];
    if (message && message.trim().length > 15) {
      try {
        const ragEngine = new RAGEngine(supabase);
        ragChunks = await ragEngine.search({
          userId,
          query: message,
          limit: 2, // reduced from 4 to save tokens
          minSimilarity: 0.72, // only include high-confidence chunks
        });
      } catch (err) {
        logger.warn('[MIND] RAG search failed, continuing without:', err);
      }
    }

    const context = {
      profile: {
        name: learnerState.profile.name,
        examType: learnerState.profile.examType,
        examDate: learnerState.profile.examDate,
        currentLevel: learnerState.profile.currentLevel,
        learningStyle: learnerState.profile.learningStyle,
        streakDays: learnerState.profile.streakDays,
        timezone: learnerState.profile.timezone,
        learnerStateVersion: learnerState.profile.version
      },
      activeGoal: learnerState.activeGoal,
      currentSessionCard: learnerState.currentMission,
      commandTasks: learnerState.command.openTasks,
      recentStudySessions: learnerState.recentStudySessions,
      weakConcepts: learnerState.atlas.weakConcepts.slice(0, 3),
      recentMistakes: learnerState.autopsy.recentMistakes.slice(0, 3),
      struggles: learnerState.autopsy.recentMistakes.slice(0, 3).map(m => ({ chapter: m.chapter, subject: m.subject })),
      masteryStats: learnerState.atlas.masterySummary,
      overdueCardsCount: learnerState.memory.dueCount,
      topOverdueCards: learnerState.memory.topDueCards.slice(0, 3),
      emotionalState: learnerState.profile.mindStateSignal,
      recentTopics: learnerState.recentTopics.slice(0, 5),
      knownAnalogies: [],
      rootGapChains,
      currentSessionDurationMinutes: 0,
      sessionGoal: '',
      ragChunks,
      studentModel: learnerState.studentModel
    };
    logger.info('[MIND] context build completed', {
      userId,
      feature: 'mind-context',
      durationMs: Date.now() - startedAt,
      learnerStateVersion: context.profile.learnerStateVersion,
      weakConceptCount: context.weakConcepts.length,
      dueCardCount: context.overdueCardsCount,
      mistakeCount: context.recentMistakes.length,
    });
    return context;
  } catch (err) {
    logger.error('getMINDContext failed', err, {
      userId,
      feature: 'mind-context',
      durationMs: Date.now() - startedAt,
    });
    // Return safe defaults — never crash the chat
    return {
      profile: { name: 'Student', examType: 'General', examDate: null, currentLevel: 'intermediate', learningStyle: 'visual', streakDays: 0, timezone: 'UTC', learnerStateVersion: 0 },
      activeGoal: null,
      currentSessionCard: null,
      commandTasks: [],
      recentStudySessions: [],
      weakConcepts: [], recentMistakes: [], struggles: [],
      masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
      overdueCardsCount: 0, topOverdueCards: [], emotionalState: 'neutral', recentTopics: [], knownAnalogies: [],
      rootGapChains: [],
      currentSessionDurationMinutes: 0,
      sessionGoal: '',
      ragChunks: [],
      studentModel: null
    };
  }
}

/**
 * Traverses the prerequisite graph backward from a weak concept
 * to find the deepest unmastered root cause.
 * Returns up to 3 root gap chains — each is the path from root to surface.
 */
export async function getRootGapChains(
  userId: string,
  weakConcepts: Array<{ name: string; subject: string; chapter: string; mastery: string }>
): Promise<Array<{ rootConcept: string; gapChain: string[] }>> {
  if (weakConcepts.length === 0) return [];

  try {
    const supabase = await createClient();

    // Fetch all concept links for this user once
    const { data: allLinks } = await supabase
      .from('concept_links')
      .select('source_concept_id, target_concept_id, link_type, strength')
      .eq('user_id', userId)
      .in('link_type', ['prerequisite', 'depends_on']);

    if (!allLinks || allLinks.length === 0) return [];

    // Build prerequisite adjacency: conceptId → [prerequisiteConceptIds]
    const prereqMap = new Map<string, string[]>();
    for (const link of allLinks) {
      const existing = prereqMap.get(link.target_concept_id) || [];
      existing.push(link.source_concept_id);
      prereqMap.set(link.target_concept_id, existing);
    }

    // Fetch all concepts for this user to resolve IDs to names+mastery
    const { data: allConcepts } = await supabase
      .from('concepts')
      .select('id, name, chapter, subject, mastery')
      .eq('user_id', userId);

    if (!allConcepts) return [];

    const concepts = allConcepts as ConceptGraphRow[];
    const conceptById = new Map(concepts.map(c => [c.id, c]));

    // Only analyse the top 3 weakest concepts to keep latency low
    const targetConcepts = weakConcepts.slice(0, 3);

    const UNMASTERED = new Set(['not_started', 'exposed', 'developing']);
    const chains: Array<{ rootConcept: string; gapChain: string[] }> = [];

    for (const weak of targetConcepts) {
      // Find the concept record
      const conceptRecord = concepts.find(
        c => c.name.toLowerCase() === weak.name.toLowerCase() || c.chapter.toLowerCase() === weak.chapter.toLowerCase()
      );
      if (!conceptRecord) continue;

      // BFS backward through prerequisites to find deepest unmastered root
      const visited = new Set<string>();
      const queue: Array<{ id: string; path: string[] }> = [{ id: conceptRecord.id, path: [conceptRecord.name] }];
      let deepestGap = { id: conceptRecord.id, path: [conceptRecord.name] };

      while (queue.length > 0) {
        const current = queue.shift()!;
        if (visited.has(current.id)) continue;
        visited.add(current.id);

        const prereqs = prereqMap.get(current.id) || [];
        for (const prereqId of prereqs) {
          const prereqConcept = conceptById.get(prereqId);
          if (!prereqConcept) continue;
          if (!UNMASTERED.has(prereqConcept.mastery)) continue; // Skip mastered prerequisites

          const newPath = [...current.path, prereqConcept.name];
          queue.push({ id: prereqId, path: newPath });

          if (newPath.length > deepestGap.path.length) {
            deepestGap = { id: prereqId, path: newPath };
          }
        }
      }

      if (deepestGap.path.length > 1) {
        const rootConceptRecord = conceptById.get(deepestGap.id);
        chains.push({
          rootConcept: rootConceptRecord?.name || deepestGap.path[deepestGap.path.length - 1],
          gapChain: deepestGap.path.reverse(), // root → surface
        });
      }
    }

    return chains;
  } catch (err) {
    logger.error('getRootGapChains failed', err);
    return [];
  }
}
