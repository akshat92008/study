import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import { getAvailableSources } from '@/lib/sources/getAvailableSources';

export interface MindContext {
  profile: {
    userId: string;
    examType?: string;
    streakDays?: number;
    lastActiveAt?: string;
  };
  activeGoal?: {
    id: string;
    title: string;
    subject?: string;
    topic?: string;
  };
  dailyMission?: {
    id: string;
    title: string;
    status: string;
    microtargets: any[];
  };
  sources: any[];
  atlas: {
    weakConcepts: any[];
    learningConcepts: any[];
    strongConcepts: any[];
    recentConcepts: any[];
  };
  memory: {
    dueCount: number;
    dueCards: any[];
  };
  recentEvents: any[];
}

/**
 * Builds the comprehensive MIND context from durable state.
 */
export async function getMindContext(
  supabase: SupabaseClient,
  userId: string,
  goalId?: string | null
): Promise<MindContext> {
  try {
    const now = new Date().toISOString();
    const today = now.split('T')[0];

    // 1. Fetch Profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, exam_type, streak_days, last_active_at')
      .eq('id', userId)
      .maybeSingle();

    // 2. Fetch Active Goal
    let activeGoalQuery = supabase
      .from('learning_goals')
      .select('id, title, status')
      .eq('user_id', userId)
      .eq('status', 'active');
    
    if (goalId) {
      activeGoalQuery = activeGoalQuery.eq('id', goalId);
    }
    const { data: goal } = await activeGoalQuery.maybeSingle();

    // 3. Fetch Daily Mission (Session Card)
    let cardQuery = supabase
      .from('session_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today);
    if (goalId) {
      cardQuery = cardQuery.eq('goal_id', goalId);
    } else {
      cardQuery = cardQuery.is('goal_id', null);
    }
    const { data: sessionCard } = await cardQuery.maybeSingle();

    // 4. Fetch Available Sources
    const sources = await getAvailableSources(supabase, userId);

    // 5. Fetch ATLAS Concepts
    const { data: concepts } = await supabase
      .from('concepts')
      .select('id, name, subject, chapter, topic, mastery, mastery_score, last_reviewed_at')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
      .limit(50);

    const atlas = {
      weakConcepts: (concepts || []).filter(c => c.mastery === 'weak' || c.mastery === 'exposed' || c.mastery === 'not_started'),
      learningConcepts: (concepts || []).filter(c => c.mastery === 'learning' || c.mastery === 'developing' || c.mastery === 'proficient'),
      strongConcepts: (concepts || []).filter(c => c.mastery === 'strong' || c.mastery === 'mastered' || c.mastery === 'automated'),
      recentConcepts: (concepts || []).slice(0, 5)
    };

    // 6. Fetch MEMORY Due Cards
    const { data: dueCards, count: dueCount } = await supabase
      .from('revision_cards')
      .select('id, front, back, concept_id', { count: 'exact' })
      .eq('user_id', userId)
      .lte('due', now)
      .neq('state', 4) // Not buried/archived
      .limit(5);

    // 7. Recent Events
    const { data: recentEvents } = await supabase
      .from('agent_actions')
      .select('id, agent_name, action_type, status, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    return {
      profile: {
        userId,
        examType: profile?.exam_type ?? undefined,
        streakDays: profile?.streak_days,
        lastActiveAt: profile?.last_active_at ?? undefined
      },
      activeGoal: goal ? { id: goal.id, title: goal.title ?? 'Active goal' } : undefined,
      dailyMission: sessionCard ? {
        id: sessionCard.id,
        title: sessionCard.focusTopic ?? 'Today mission',
        status: sessionCard.isCompleted ? 'completed' : 'active',
        microtargets: [] // Injected by update logic if needed
      } : undefined,
      sources,
      atlas,
      memory: {
        dueCount: dueCount || 0,
        dueCards: dueCards || []
      },
      recentEvents: recentEvents || []
    };
  } catch (err) {
    logger.error('getMindContext failed', { userId, error: err });
    throw err;
  }
}
