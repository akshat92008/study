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

  let query = supabase
    .from('concepts')
    .select('subject, chapter, mastery')
    .eq('user_id', userId);
  if (goalId) query = query.eq('goal_id', goalId);

  const { data: concepts, error } = await query;

  if (error || !concepts || concepts.length === 0) return null;

  // ── Deduplicate to chapter level ──────────────────────────────────────────
  // There are ~10 micro-concepts per chapter from AI expansion.
  // We take the BEST mastery per chapter so one studied micro-concept
  // counts the whole chapter as touched.
  const chapterBest = new Map<string, { subject: string; chapter: string; mastery: string }>();

  for (const c of concepts) {
    const key = `${c.subject}::${c.chapter}`;
    const existing = chapterBest.get(key);
    if (!existing || (MASTERY_TIER[c.mastery] ?? 0) > (MASTERY_TIER[existing.mastery] ?? 0)) {
      chapterBest.set(key, { subject: c.subject, chapter: c.chapter, mastery: c.mastery });
    }
  }

  const chapters = Array.from(chapterBest.values());
  const total = chapters.length; // e.g. 87 for NEET

  const weightedSum = chapters.reduce((sum, c) => sum + (MASTERY_WEIGHT[c.mastery] ?? 0), 0);
  const overallPct = Math.round((weightedSum / total) * 100);

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
    bySubject[c.subject].weightedSum += MASTERY_WEIGHT[c.mastery] ?? 0;
    bySubject[c.subject].chapters.push({
      chapter: c.chapter,
      mastery: c.mastery,
      pct: Math.round((MASTERY_WEIGHT[c.mastery] ?? 0) * 100),
    });
  }

  const subjects = Object.entries(bySubject).map(([subject, data]) => ({
    subject,
    totalChapters: data.total,
    masteryPct: Math.round((data.weightedSum / data.total) * 100),
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
  };
}
