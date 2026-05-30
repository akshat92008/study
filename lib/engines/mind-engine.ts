// lib/engines/mind-engine.ts
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { MINDContext } from '@/lib/ai/prompts/mind-prompt';
import { RAGEngine } from './rag-engine';

type ConceptGraphRow = {
  id: string;
  name: string;
  chapter: string;
  subject: string;
  mastery: string;
};

export async function getMINDContext(userId: string, message?: string, topic?: string, subject?: string): Promise<MINDContext> {
  try {
    const supabase = await createClient();

    let weakConceptsQuery = supabase.from('concepts')
      .select('name, subject, chapter, mastery')
      .eq('user_id', userId)
      .in('mastery', ['not_started', 'exposed', 'developing'])
      .order('mastery')
      .limit(3);
    if (subject) weakConceptsQuery = weakConceptsQuery.eq('subject', subject);
    if (topic) weakConceptsQuery = weakConceptsQuery.ilike('chapter', `%${topic}%`);

    let mistakesQuery = supabase.from('mistakes')
      .select('chapter, category, subject, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(3);
    if (subject) mistakesQuery = mistakesQuery.eq('subject', subject);
    if (topic) mistakesQuery = mistakesQuery.ilike('chapter', `%${topic}%`);

    const [
      profileRes, weakConceptsRes, recentMistakesRes,
      overdueRes, masteryRes, sessionsRes, goalRes, sessionCardRes, taskRes
    ] = await Promise.all([
      supabase.from('profiles')
        .select('full_name, exam_type, target_date, current_level, learning_style, streak_days, emotional_state, timezone, learner_state_version')
        .eq('id', userId)
        .single(),

      weakConceptsQuery,

      mistakesQuery,

      supabase.from('revision_cards')
        .select('id, front', { count: 'exact' })
        .eq('user_id', userId)
        .lte('due', new Date().toISOString())
        .limit(3),

      Promise.all([
        supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('mastery', ['mastered', 'automated'])
      ]),

      supabase.from('study_sessions')
        .select('notes, started_at, subject, chapter, duration_minutes')
        .eq('user_id', userId)
        .not('notes', 'is', null)
        .order('started_at', { ascending: false })
        .limit(5),

      supabase.from('learning_goals')
        .select('title, target_date, progress')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle(),

      supabase.from('session_cards')
        .select('"focusTopic", subject, "estimatedMinutes", rationale, learner_state_version')
        .eq('user_id', userId)
        .eq('date', new Date().toISOString().split('T')[0])
        .maybeSingle(),

      supabase.from('study_tasks')
        .select('title, subject, chapter, priority')
        .eq('user_id', userId)
        .eq('scheduled_date', new Date().toISOString().split('T')[0])
        .eq('is_completed', false)
        .order('priority', { ascending: false })
        .limit(5)
    ]);

    const { data: studentModel } = await supabase
      .from('student_models')
      .select('learning_style, strengths, weaknesses, behavioral_traps, last_updated_at')
      .eq('user_id', userId)
      .order('last_updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const profile = profileRes.data;
    const [totalRes, masteredRes] = masteryRes;
    const total = totalRes.count || 0;
    const mastered = masteredRes.count || 0;

    const rootGapChains = await getRootGapChains(userId, weakConceptsRes.data || []);

    // Extract recently studied topics from session summaries
    const recentTopics = (sessionsRes.data || [])
      .map(s => s.chapter || s.notes?.match(/studied\s+(.+?)(?:\s+\(|\.)/i)?.[1])
      .filter(Boolean) as string[];

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

    return {
      profile: {
        name: profile?.full_name || 'Student',
        examType: profile?.exam_type || 'General',
        examDate: profile?.target_date || null,
        currentLevel: profile?.current_level || 'intermediate',
        learningStyle: profile?.learning_style || 'visual',
        streakDays: profile?.streak_days || 0,
        timezone: profile?.timezone || 'UTC',
        learnerStateVersion: profile?.learner_state_version || 0
      },
      activeGoal: goalRes.data
        ? {
            title: goalRes.data.title,
            targetDate: goalRes.data.target_date ?? null,
            progress: goalRes.data.progress ?? null,
          }
        : null,
      currentSessionCard: sessionCardRes.data
        ? {
            focusTopic: sessionCardRes.data.focusTopic,
            subject: sessionCardRes.data.subject,
            estimatedMinutes: sessionCardRes.data.estimatedMinutes,
            rationale: sessionCardRes.data.rationale,
          }
        : null,
      commandTasks: taskRes.data || [],
      recentStudySessions: (sessionsRes.data || []).map((s: any) => ({
        subject: s.subject,
        chapter: s.chapter,
        durationMinutes: s.duration_minutes ?? null,
      })),
      weakConcepts: weakConceptsRes.data || [],
      recentMistakes: recentMistakesRes.data || [],
      struggles: (recentMistakesRes.data || []).map(m => ({ chapter: m.chapter, subject: m.subject })),
      masteryStats: {
        totalConcepts: total,
        masteredCount: mastered,
        masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0
      },
      overdueCardsCount: overdueRes.count || 0,
      topOverdueCards: (overdueRes.data || []).map((c: any) => ({ id: c.id, front: c.front })),
      emotionalState: profile?.emotional_state || 'neutral',
      recentTopics,
      knownAnalogies: [],
      rootGapChains,
      currentSessionDurationMinutes: 0,
      sessionGoal: '',
      ragChunks,
      studentModel: studentModel ?? null
    };
  } catch (err) {
    logger.error('getMINDContext failed', err);
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
