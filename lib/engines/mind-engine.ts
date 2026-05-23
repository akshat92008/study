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
        .select('full_name, exam_type, exam_date, current_level, learning_style, streak_days, emotional_state')
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
        .lte('next_review', new Date().toISOString()),

      Promise.all([
        supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId),
        supabase.from('concepts').select('id', { count: 'exact', head: true }).eq('user_id', userId).in('mastery', ['mastered', 'automated'])
      ]),

      supabase.from('study_sessions')
        .select('summary, started_at')
        .eq('user_id', userId)
        .not('summary', 'is', null)
        .order('started_at', { ascending: false })
        .limit(5)
    ]);

    const profile = profileRes.data;
    const [totalRes, masteredRes] = masteryRes;
    const total = totalRes.count || 0;
    const mastered = masteredRes.count || 0;

    // Extract recently studied topics from session summaries
    const recentTopics = (sessionsRes.data || [])
      .map(s => s.summary?.match(/studied\s+(.+?)(?:\s+\(|\.)/i)?.[1])
      .filter(Boolean) as string[];

    return {
      profile: {
        name: profile?.full_name || 'Student',
        examType: profile?.exam_type || 'General',
        examDate: profile?.exam_date || null,
        currentLevel: profile?.current_level || 'intermediate',
        learningStyle: profile?.learning_style || 'visual',
        streakDays: profile?.streak_days || 0
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
      knownAnalogies: []
    };
  } catch (err) {
    logger.error('getMINDContext failed', err);
    // Return safe defaults — never crash the chat
    return {
      profile: { name: 'Student', examType: 'General', examDate: null, currentLevel: 'intermediate', learningStyle: 'visual', streakDays: 0 },
      weakConcepts: [], recentMistakes: [], struggles: [],
      masteryStats: { totalConcepts: 0, masteredCount: 0, masteryPercent: 0 },
      overdueCards: 0, emotionalState: 'neutral', recentTopics: [], knownAnalogies: []
    };
  }
}
