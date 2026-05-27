// lib/engines/mind-engine.ts
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';
import type { MINDContext } from '@/lib/ai/prompts/mind-prompt';

export async function getMINDContext(userId: string, message?: string): Promise<MINDContext> {
  try {
    const supabase = await createClient();

    const [
      profileRes, weakConceptsRes, recentMistakesRes,
      overdueRes, masteryRes, sessionsRes
    ] = await Promise.all([
      supabase.from('profiles')
        .select('full_name, exam_type, exam_date, current_level, learning_style, streak_days, emotional_state, timezone')
        .eq('id', userId)
        .single(),

      supabase.from('concepts')
        .select('name, subject, chapter, mastery')
        .eq('user_id', userId)
        .in('mastery', ['not_started', 'exposed', 'developing'])
        .order('mastery')
        .limit(10),

      supabase.from('mistakes')
        .select('chapter, category, subject, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),

      supabase.from('revision_cards')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .lte('due', new Date().toISOString()),

      Promise.all([
        supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('mastery', ['mastered', 'automated'])
      ]),

      supabase.from('study_sessions')
        .select('notes, started_at, subject, chapter')
        .eq('user_id', userId)
        .not('notes', 'is', null)
        .order('started_at', { ascending: false })
        .limit(5)
    ]);

    const profile = profileRes.data;
    const [totalRes, masteredRes] = masteryRes;
    const total = totalRes.count || 0;
    const mastered = masteredRes.count || 0;

    const rootGapChains = await getRootGapChains(userId, weakConceptsRes.data || []);

    // Extract recently studied topics from session summaries
    const recentTopics = (sessionsRes.data || [])
      .map(s => s.chapter || s.notes?.match(/studied\s+(.+?)(?:\s+\(|\.)/i)?.[1])
      .filter(Boolean) as string[];

    return {
      profile: {
        name: profile?.full_name || 'Student',
        examType: profile?.exam_type || 'General',
        examDate: profile?.exam_date || null,
        currentLevel: profile?.current_level || 'intermediate',
        learningStyle: profile?.learning_style || 'visual',
        streakDays: profile?.streak_days || 0,
        timezone: profile?.timezone || 'UTC'
      },
      weakConcepts: weakConceptsRes.data || [],
      recentMistakes: recentMistakesRes.data || [],
      struggles: (recentMistakesRes.data || []).map(m => ({ chapter: m.chapter, subject: m.subject })),
      masteryStats: {
        totalConcepts: total,
        masteredCount: mastered,
        masteryPercent: total > 0 ? Math.round((mastered / total) * 100) : 0
      },
      overdueCards: overdueRes.count || 0,
      emotionalState: profile?.emotional_state || 'neutral',
      recentTopics,
      knownAnalogies: [],
      rootGapChains,
      currentSessionDurationMinutes: 0,
      sessionGoal: ''
    };
  } catch (err) {
    logger.error('getMINDContext failed', err);
    // Return safe defaults — never crash the chat
    return {
      profile: { name: 'Student', examType: 'General', examDate: null, currentLevel: 'intermediate', learningStyle: 'visual', streakDays: 0, timezone: 'UTC' },
      weakConcepts: [], recentMistakes: [], struggles: [],
      masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
      overdueCards: 0, emotionalState: 'neutral', recentTopics: [], knownAnalogies: [],
      rootGapChains: [],
      currentSessionDurationMinutes: 0,
      sessionGoal: ''
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

    const conceptById = new Map(allConcepts.map(c => [c.id, c]));

    // Only analyse the top 3 weakest concepts to keep latency low
    const targetConcepts = weakConcepts.slice(0, 3);

    const UNMASTERED = new Set(['not_started', 'exposed', 'developing']);
    const chains: Array<{ rootConcept: string; gapChain: string[] }> = [];

    for (const weak of targetConcepts) {
      // Find the concept record
      const conceptRecord = allConcepts.find(
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
