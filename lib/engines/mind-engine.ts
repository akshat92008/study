// lib/engines/mind-engine.ts
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { MINDContext } from '@/lib/ai/prompts/mind-prompt';
import { RAGEngine } from './rag-engine';
import type { RagContext } from '@/lib/rag/types';
import { getLearnerStateSnapshot } from '@/lib/learner-state/getLearnerState';
import { OutcomeAnalyticsService } from '@/lib/services/outcome-analytics.service';

type ConceptGraphRow = {
  id: string;
  name: string;
  chapter: string;
  subject: string;
  mastery: string;
};

export async function getMINDContext(userId: string, message?: string, topic?: string, subject?: string, goalId?: string | null): Promise<MINDContext> {
  const startedAt = Date.now();
  try {
    logger.info('[MIND] context build started', { userId, feature: 'mind-context' });
    const supabase = await createClient();
    const learnerState = await getLearnerStateSnapshot(userId, { topic, subject, goalId, client: supabase });
    const outcomeSummary = await new OutcomeAnalyticsService(supabase)
      .getSummary(userId)
      .catch((err) => {
        logger.warn('[MIND] outcome analytics unavailable', { userId, err });
        return null;
      });
    const rootGapChains = await getRootGapChains(userId, learnerState.atlas.weakConcepts);
    const conceptHistory = await getLongitudinalConceptHistory(userId, {
      topic,
      subject,
      goalId,
      weakConcepts: learnerState.atlas.weakConcepts,
      client: supabase,
    });
    const agentActivity = await getAgentActivitySummary(userId, supabase);
    const cognitiveLoad = deriveCognitiveLoadSignal(learnerState);

    let ragChunks: {
      text: string;
      similarity: number;
      sourceTitle: string;
      citation?: string;
      pageStart?: number | null;
      pageEnd?: number | null;
      heading?: string | null;
    }[] = [];
    let ragContext: RagContext | null = null;
    if (message && message.trim().length > 15) {
      try {
        const ragEngine = new RAGEngine();
        ragContext = await ragEngine.retrieve({
          userId,
          query: message,
          subject,
          chapter: topic,
          goalId: goalId ?? undefined,
        });
        const { formatCitation } = await import('@/lib/rag/citations');
        // Limit to 3 sources for faster response as per CHAT_CONTEXT_LIMITS
        ragChunks = ragContext.chunks.slice(0, 3).map((chunk) => ({
          text: chunk.text,
          similarity: chunk.score,
          sourceTitle: chunk.materialTitle,
          citation: formatCitation({
            title: chunk.materialTitle,
            pageStart: chunk.pageStart,
            pageEnd: chunk.pageEnd,
            heading: chunk.heading,
          }),
          pageStart: chunk.pageStart,
          pageEnd: chunk.pageEnd,
          heading: chunk.heading,
        }));
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
      weakConcepts: learnerState.atlas.weakConcepts.slice(0, 5),
      recentMistakes: learnerState.autopsy.recentMistakes.slice(0, 5),
      needsReviewCount: learnerState.autopsy.needsReviewCount,
      lastAutopsy: learnerState.autopsy.lastAutopsy,
      dueRetests: learnerState.autopsy.dueRetests,
      openRepairMistakes: learnerState.autopsy.openRepairMistakes,
      recentPracticeStruggles: await getRecentPracticeStruggles(userId, supabase, goalId),
      struggles: learnerState.autopsy.recentMistakes.slice(0, 5).map(m => ({ chapter: m.chapter, subject: m.subject })),
      masteryStats: learnerState.atlas.masterySummary,
      overdueCardsCount: learnerState.memory.dueCount,
      topOverdueCards: learnerState.memory.topDueCards.slice(0, 5),
      emotionalState: learnerState.profile.mindStateSignal,
      recentTopics: learnerState.recentTopics.slice(0, 5),
      seededTopics: learnerState.seededTopics.slice(0, 5),
      conceptHistory,
      cognitiveLoad,
      knownAnalogies: [],
      rootGapChains,
      currentSessionDurationMinutes: 0,
      sessionGoal: '',
      ragChunks,
      ragContext,
      studentModel: learnerState.studentModel,
      outcomeAnalytics: outcomeSummary,
      agentActivity,
      hermesMemories: learnerState.hermesMemories,
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
      weakConcepts: [], recentMistakes: [], recentPracticeStruggles: [], struggles: [],
      needsReviewCount: 0, lastAutopsy: null,
      masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
      overdueCardsCount: 0, topOverdueCards: [], emotionalState: 'neutral', recentTopics: [], seededTopics: [], knownAnalogies: [],
      conceptHistory: [],
      cognitiveLoad: { level: 'normal', signals: [] },
      rootGapChains: [],
      currentSessionDurationMinutes: 0,
      sessionGoal: '',
      ragChunks: [],
      ragContext: null,
      studentModel: null,
      outcomeAnalytics: null,
      agentActivity: { recentRuns: [], recentActions: [], pendingApprovalCount: 0 },
    };
  }
}

async function getAgentActivitySummary(userId: string, supabase: any): Promise<MINDContext['agentActivity']> {
  try {
    const [runsRes, actionsRes, pendingRes] = await Promise.all([
      supabase
        .from('agent_runs')
        .select('agent_name, status, created_at, error')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('agent_actions')
        .select('action_type, status, approval_status, reason, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('agent_actions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('approval_status', 'pending'),
    ]);

    if (runsRes.error || actionsRes.error || pendingRes.error) {
      return { recentRuns: [], recentActions: [], pendingApprovalCount: 0 };
    }

    return {
      recentRuns: (runsRes.data || []).map((run: any) => ({
        agentName: run.agent_name,
        status: run.status,
        createdAt: run.created_at,
        error: run.error ?? null,
      })),
      recentActions: (actionsRes.data || []).map((action: any) => ({
        actionType: action.action_type,
        status: action.status,
        approvalStatus: action.approval_status,
        createdAt: action.created_at,
        reason: action.reason ?? null,
      })),
      pendingApprovalCount: pendingRes.count || 0,
    };
  } catch (err) {
    logger.warn('[MIND] agent activity unavailable', { userId, err });
    return { recentRuns: [], recentActions: [], pendingApprovalCount: 0 };
  }
}

async function getLongitudinalConceptHistory(
  userId: string,
  options: {
    topic?: string;
    subject?: string;
    goalId?: string | null;
    weakConcepts: Array<{ name: string; subject: string; chapter: string; mastery: string }>;
    client: any;
  }
): Promise<Array<{
  conceptId?: string | null;
  conceptName: string;
  subject: string;
  chapter: string;
  lastSeenAt: string;
  outcome: string;
  source: string;
}>> {
  try {
    const supabase = options.client;
    const targetSubject = options.subject || options.weakConcepts[0]?.subject;
    const targetTopic = options.topic || options.weakConcepts[0]?.chapter || options.weakConcepts[0]?.name;

    let conceptQuery = supabase
      .from('concepts')
      .select('id, name, subject, chapter, mastery, updated_at')
      .eq('user_id', userId)
      .limit(8);

    if (targetSubject) conceptQuery = conceptQuery.eq('subject', targetSubject);
    if (options.goalId) conceptQuery = conceptQuery.eq('goal_id', options.goalId);
    if (targetTopic) conceptQuery = conceptQuery.or(`chapter.ilike.%${targetTopic}%,name.ilike.%${targetTopic}%`);

    const { data: concepts } = await conceptQuery;
    const conceptRows: any[] = concepts || [];
    if (!conceptRows.length) return [];

    const conceptById = new Map<string, any>(conceptRows.map((concept: any) => [concept.id, concept]));
    const conceptIds = conceptRows.map((concept: any) => concept.id).filter(Boolean);
    const chapters = Array.from(new Set(conceptRows.map((concept: any) => concept.chapter).filter(Boolean)));

    const [eventsRes, sessionsRes] = await Promise.all([
      supabase
        .from('mastery_events')
        .select('concept_id, evidence, evidence_type, source, weight, created_at')
        .eq('user_id', userId)
        .in('concept_id', conceptIds)
        .order('created_at', { ascending: false })
        .limit(8),
      chapters.length
        ? supabase
            .from('study_sessions')
            .select('subject, chapter, concept_name, understood, gap_found, completed_at, created_at, session_type')
            .eq('user_id', userId)
            .in('chapter', chapters)
            .order('created_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [] }),
    ]);

    const history: Array<{
      conceptId?: string | null;
      conceptName: string;
      subject: string;
      chapter: string;
      lastSeenAt: string;
      outcome: string;
      source: string;
    }> = [];

    for (const event of eventsRes.data || []) {
      const concept = conceptById.get(event.concept_id);
      if (!concept) continue;
      const weight = Number(event.weight ?? 0);
      history.push({
        conceptId: event.concept_id,
        conceptName: concept.name,
        subject: concept.subject,
        chapter: concept.chapter,
        lastSeenAt: event.created_at,
        outcome: event.evidence || (weight < 0 ? 'student struggled here' : 'student showed understanding here'),
        source: event.source || event.evidence_type || 'mastery_event',
      });
    }

    for (const session of sessionsRes.data || []) {
      history.push({
        conceptName: session.concept_name || session.chapter,
        subject: session.subject,
        chapter: session.chapter,
        lastSeenAt: session.completed_at || session.created_at,
        outcome: session.understood === false
          ? `session surfaced gap${session.gap_found ? `: ${session.gap_found}` : ''}`
          : 'session completed with understanding signal',
        source: session.session_type || 'study_session',
      });
    }

    return history
      .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
      .slice(0, 6);
  } catch (err) {
    logger.warn('[MIND] longitudinal concept history unavailable', { userId, err });
    return [];
  }
}

async function getRecentPracticeStruggles(userId: string, supabase: any, goalId?: string | null) {
  try {
    let query = supabase
      .from('mastery_events')
      .select('evidence, created_at, concepts(name, chapter, subject)')
      .eq('user_id', userId)
      .eq('source', 'practice')
      .eq('evidence_type', 'practice_wrong')
      .order('created_at', { ascending: false })
      .limit(3);

    if (goalId) {
      query = query.eq('concepts.goal_id', goalId);
    }

    const { data } = await query;
    
    if (!data) return [];
    return data.map((d: any) => ({
      conceptName: d.concepts?.name || 'Unspecified',
      chapter: d.concepts?.chapter || 'Unspecified',
      subject: d.concepts?.subject || 'Unspecified',
      evidence: d.evidence
    }));
  } catch (err) {
    logger.warn('[MIND] recent practice struggles unavailable', { userId, err });
    return [];
  }
}

function deriveCognitiveLoadSignal(learnerState: Awaited<ReturnType<typeof getLearnerStateSnapshot>>): MINDContext['cognitiveLoad'] {
  const signals: string[] = [];
  const emotionalState = learnerState.profile.mindStateSignal;

  if (['overwhelmed', 'burnt_out', 'frustrated', 'anxious', 'stressed'].includes(emotionalState)) {
    signals.push(`Current emotional state is ${emotionalState}.`);
  }
  if (learnerState.memory.dueCount >= 40) {
    signals.push(`${learnerState.memory.dueCount} revision cards are due.`);
  }
  if (learnerState.atlas.weakConcepts.length >= 5) {
    signals.push('Multiple weak concepts are active.');
  }

  return {
    level: signals.length >= 2 || ['overwhelmed', 'burnt_out'].includes(emotionalState) ? 'high' : 'normal',
    signals,
  };
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
