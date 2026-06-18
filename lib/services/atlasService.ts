import { createClient } from '@/lib/supabase/server';

const MASTERY_WEIGHT: Record<string, number> = {
  not_started: 0,
  exposed:     0.2,
  developing:  0.4,
  proficient:  0.65,
  mastered:    0.85,
  automated:   1.0,
};

// Tier order for picking best mastery per chapter
const MASTERY_TIER: Record<string, number> = {
  not_started: 0,
  exposed:     1,
  developing:  2,
  proficient:  3,
  mastered:    4,
  automated:   5,
};

export async function getSyllabusMastery(userId: string, goalId?: string | null) {
  const supabase = await createClient();

  let skeletonQuery = supabase
    .from('seeded_topics')
    .select('subject, chapter, topic, microtarget')
    .eq('user_id', userId);
  if (goalId) skeletonQuery = skeletonQuery.eq('goal_id', goalId);

  let conceptsQuery = supabase
    .from('concepts')
    .select('subject, chapter, topic, name, mastery')
    .eq('user_id', userId);
  if (goalId) conceptsQuery = conceptsQuery.eq('goal_id', goalId);

  const [skeletonRes, conceptsRes] = await Promise.all([skeletonQuery, conceptsQuery]);

  const skeleton = skeletonRes.data || [];
  const concepts = conceptsRes.data || [];

  if (skeleton.length === 0 && concepts.length === 0) return null;

  // ── Build a map of user mastery for quick lookup ───────────────────────────
  const conceptMasteryMap = new Map<string, string>();
  for (const c of concepts) {
    // Try to match by subject::chapter::topic::name
    const key = `${c.subject}::${c.chapter}::${c.topic}::${c.name}`;
    conceptMasteryMap.set(key, c.mastery);
    // Also store a fallback just by chapter::name in case subject/topic drift
    const fallbackKey = `${c.chapter}::${c.name}`;
    if (!conceptMasteryMap.has(fallbackKey)) {
      conceptMasteryMap.set(fallbackKey, c.mastery);
    }
  }

  // ── Compute true mastery per microtarget using skeleton ────────────────────
  const microtargets: Array<{ subject: string; chapter: string; topic: string; microtarget: string; mastery: string }> = [];

  if (skeleton.length > 0) {
    for (const st of skeleton) {
      const key = `${st.subject}::${st.chapter}::${st.topic}::${st.microtarget}`;
      const fallbackKey = `${st.chapter}::${st.microtarget}`;
      const mastery = conceptMasteryMap.get(key) || conceptMasteryMap.get(fallbackKey) || 'not_started';
      microtargets.push({ subject: st.subject, chapter: st.chapter, topic: st.topic, microtarget: st.microtarget, mastery });
    }
  } else {
    // Fallback if no skeleton exists: use concepts directly as microtargets
    for (const c of concepts) {
      microtargets.push({ subject: c.subject, chapter: c.chapter, topic: c.topic, microtarget: c.name, mastery: c.mastery });
    }
  }

  // ── Group microtargets by chapter to calculate precise chapter averages ────
  const chapterMap = new Map<string, { subject: string; chapter: string; totalMicrotargets: number; totalWeight: number; bestMastery: string }>();

  for (const mt of microtargets) {
    const key = `${mt.subject}::${mt.chapter}`;
    if (!chapterMap.has(key)) {
      chapterMap.set(key, { subject: mt.subject, chapter: mt.chapter, totalMicrotargets: 0, totalWeight: 0, bestMastery: 'not_started' });
    }
    const chapterStats = chapterMap.get(key)!;
    chapterStats.totalMicrotargets++;
    const weight = MASTERY_WEIGHT[mt.mastery] ?? 0;
    chapterStats.totalWeight += weight;

    // Track the highest mastery seen in this chapter for display labels
    if ((MASTERY_TIER[mt.mastery] ?? 0) > (MASTERY_TIER[chapterStats.bestMastery] ?? 0)) {
      chapterStats.bestMastery = mt.mastery;
    }
  }

  const chapters = Array.from(chapterMap.values()).map(c => {
    const avgWeight = c.totalMicrotargets > 0 ? c.totalWeight / c.totalMicrotargets : 0;
    // Reverse map average weight back to a mastery string for the dashboard pie charts
    let avgMastery = 'not_started';
    if (avgWeight >= 0.9) avgMastery = 'automated';
    else if (avgWeight >= 0.75) avgMastery = 'mastered';
    else if (avgWeight >= 0.5) avgMastery = 'proficient';
    else if (avgWeight >= 0.3) avgMastery = 'developing';
    else if (avgWeight > 0) avgMastery = 'exposed';

    return {
      subject: c.subject,
      chapter: c.chapter,
      mastery: avgMastery,
      pct: Math.round(avgWeight * 100)
    };
  });

  const total = chapters.length;

  const weightedSum = chapters.reduce((sum, c) => sum + (c.pct / 100), 0);
  const overallPct = total > 0 ? Math.round((weightedSum / total) * 100) : 0;

  // ── Group by subject ──────────────────────────────────────────────────────
  const bySubject: Record<string, {
    total: number;
    weightedSum: number;
    chapters: Array<{ chapter: string; mastery: string; pct: number }>;
  }> = {};

  for (const c of chapters) {
    if (!bySubject[c.subject]) {
      bySubject[c.subject] = { total: 0, weightedSum: 0, chapters: [] };
    }
    bySubject[c.subject].total++;
    bySubject[c.subject].weightedSum += (c.pct / 100);
    bySubject[c.subject].chapters.push({
      chapter: c.chapter,
      mastery: c.mastery,
      pct: c.pct,
    });
  }

  const subjects = Object.entries(bySubject).map(([subject, data]) => ({
    subject,
    totalChapters: data.total,
    masteryPct: data.total > 0 ? Math.round((data.weightedSum / data.total) * 100) : 0,
    chapters: data.chapters,
    breakdown: {
      not_started: data.chapters.filter(c => c.mastery === 'not_started').length,
      exposed:     data.chapters.filter(c => c.mastery === 'exposed').length,
      developing:  data.chapters.filter(c => c.mastery === 'developing').length,
      proficient:  data.chapters.filter(c => c.mastery === 'proficient').length,
      mastered:    data.chapters.filter(c => c.mastery === 'mastered').length,
      automated:   data.chapters.filter(c => c.mastery === 'automated').length,
    },
  }));

  return {
    overallPct,
    totalChapters: total,
    coveredChapters: chapters.filter(c => c.mastery !== 'not_started').length,
    subjects,
    // Return precise microtargets for the cognition graph
    concepts: microtargets,
  };
}
