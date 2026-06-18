import { createClient } from '@supabase/supabase-js';

export type WeakAreaQueryOptions = {
  userId: string;
  goalId: string;
  chapterSlug?: string;
  topicSlug?: string;
  granularity?: "chapter" | "topic" | "subtopic" | "concept" | "microskill" | "error_pattern";
  limit?: number;
};

export async function getWeakAreasForUser(supabase: any, options: WeakAreaQueryOptions) {
  const { userId, goalId, chapterSlug, topicSlug, granularity = "concept", limit = 10 } = options;

  let query = supabase
    .from('weak_area_events')
    .select('*')
    .eq('user_id', userId)
    .eq('goal_id', goalId)
    .is('resolved_at', null)
    .order('evidence_count', { ascending: false })
    .order('created_at', { ascending: false });

  if (chapterSlug) {
    query = query.eq('chapter_slug', chapterSlug);
  }
  if (topicSlug) {
    query = query.eq('topic_slug', topicSlug);
  }

  const { data: rawEvents, error } = await query;
  if (error) throw error;

  // Aggregate by granularity
  const aggregationMap = new Map<string, any>();
  
  for (const event of rawEvents) {
    let key = '';
    let displayPath = event.display_path || [];
    
    // Grouping logic based on granularity
    if (granularity === 'chapter') {
      key = event.chapter_slug;
      displayPath = [event.chapter_slug.replace(/-/g, ' ')];
    } else if (granularity === 'topic') {
      key = `${event.chapter_slug}::${event.topic_slug}`;
      displayPath = displayPath.slice(0, 2);
    } else if (granularity === 'subtopic') {
      key = `${event.chapter_slug}::${event.topic_slug}::${event.subtopic_slug}`;
      displayPath = displayPath.slice(0, 3);
    } else if (granularity === 'concept') {
      key = `${event.chapter_slug}::${event.topic_slug}::${event.subtopic_slug}::${event.concept_slug}`;
      displayPath = displayPath.slice(0, 4);
    } else if (granularity === 'microskill') {
      key = `${event.chapter_slug}::${event.topic_slug}::${event.subtopic_slug}::${event.concept_slug}::${event.microskill_slug}`;
      displayPath = displayPath.slice(0, 5);
    } else {
      key = `${event.chapter_slug}::${event.topic_slug}::${event.subtopic_slug}::${event.concept_slug}::${event.microskill_slug}::${event.error_pattern_slug}`;
    }

    if (!aggregationMap.has(key)) {
      aggregationMap.set(key, {
        displayPath,
        subject: event.subject,
        chapterSlug: event.chapter_slug,
        topicSlug: event.topic_slug,
        subtopicSlug: event.subtopic_slug,
        conceptSlug: event.concept_slug,
        microskillSlug: event.microskill_slug,
        severity: event.severity,
        confidence: event.confidence,
        evidenceCount: 0,
        lastSeenAt: event.created_at,
        missingPoints: new Set<string>(),
        misconceptionNotes: new Set<string>(),
        recommendedAction: event.recommended_action
      });
    }

    const agg = aggregationMap.get(key);
    agg.evidenceCount += event.evidence_count;
    
    // Upgrade severity logic during aggregation if needed
    if (event.severity === 'urgent') agg.severity = 'urgent';
    else if (event.severity === 'high' && agg.severity !== 'urgent') agg.severity = 'high';

    (event.missing_points || []).forEach((p: string) => agg.missingPoints.add(p));
    (event.misconception_notes || []).forEach((p: string) => agg.misconceptionNotes.add(p));
  }

  // Convert sets to arrays
  const weakAreas = Array.from(aggregationMap.values())
    .sort((a, b) => b.evidenceCount - a.evidenceCount)
    .slice(0, limit)
    .map(agg => ({
      ...agg,
      missingPoints: Array.from(agg.missingPoints),
      misconceptionNotes: Array.from(agg.misconceptionNotes),
    }));

  // Build chapter summary
  const chapterSummaryMap = new Map<string, { chapterSlug: string; weakConceptCount: number; urgentCount: number }>();
  for (const event of rawEvents) {
    if (!chapterSummaryMap.has(event.chapter_slug)) {
      chapterSummaryMap.set(event.chapter_slug, { chapterSlug: event.chapter_slug, weakConceptCount: 0, urgentCount: 0 });
    }
    const cs = chapterSummaryMap.get(event.chapter_slug)!;
    cs.weakConceptCount += 1;
    if (event.severity === 'urgent') {
      cs.urgentCount += 1;
    }
  }

  const chapterSummary = Array.from(chapterSummaryMap.values());
  const totalConcepts = rawEvents.length;

  let summary = '';
  if (totalConcepts === 0) {
    summary = "I do not have enough attempt data yet. Answer 5–10 tutor questions and I'll identify concept-level weak areas.";
  } else if (chapterSlug) {
    summary = `You have ${weakAreas.length} active weak concepts in ${chapterSlug.replace(/-/g, ' ')}.`;
  } else {
    summary = `You have ${totalConcepts} active weak concepts across ${chapterSummary.length} chapters.`;
  }

  return {
    summary,
    weakAreas,
    chapterSummary
  };
}
