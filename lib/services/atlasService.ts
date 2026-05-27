// lib/services/atlasService.ts

import { createClient } from '@/lib/supabase/server';

export async function getSyllabusMastery(userId: string) {
  const supabase = await createClient();

  const { data: concepts, error } = await supabase
    .from('concepts')
    .select('subject, chapter, mastery')
    .eq('user_id', userId)
    .order('subject')
    .order('chapter');

  if (error || !concepts) return null;

  const masteryWeight: Record<string, number> = {
    not_started:  0,
    exposed:      0.2,
    developing:   0.4,
    proficient:   0.65,
    mastered:     0.85,
    automated:    1.0,
  };

  const total = concepts.length;
  if (total === 0) return null;

  const weightedSum = concepts.reduce((sum, c) => sum + (masteryWeight[c.mastery] ?? 0), 0);
  const overallPct = Math.round((weightedSum / total) * 100);

  // Group by subject
  const bySubject: Record<string, {
    total: number;
    weightedSum: number;
    chapters: Array<{ chapter: string; mastery: string; pct: number }>;
  }> = {};

  for (const c of concepts) {
    if (!bySubject[c.subject]) {
      bySubject[c.subject] = { total: 0, weightedSum: 0, chapters: [] };
    }
    bySubject[c.subject].total++;
    bySubject[c.subject].weightedSum += masteryWeight[c.mastery] ?? 0;
    bySubject[c.subject].chapters.push({
      chapter: c.chapter,
      mastery: c.mastery,
      pct: Math.round((masteryWeight[c.mastery] ?? 0) * 100),
    });
  }

  const subjects = Object.entries(bySubject).map(([subject, data]) => ({
    subject,
    totalChapters: data.total,
    masteryPct: Math.round((data.weightedSum / data.total) * 100),
    chapters: data.chapters,
    breakdown: {
      not_started:  data.chapters.filter(c => c.mastery === 'not_started').length,
      exposed:      data.chapters.filter(c => c.mastery === 'exposed').length,
      developing:   data.chapters.filter(c => c.mastery === 'developing').length,
      proficient:   data.chapters.filter(c => c.mastery === 'proficient').length,
      mastered:     data.chapters.filter(c => c.mastery === 'mastered').length,
      automated:    data.chapters.filter(c => c.mastery === 'automated').length,
    },
  }));

  return {
    overallPct,
    totalChapters: total,
    coveredChapters: concepts.filter(c => c.mastery !== 'not_started').length,
    subjects,
  };
}
