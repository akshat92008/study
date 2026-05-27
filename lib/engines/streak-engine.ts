import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * Single source of truth for streak logic.
 * Call this from both session-close route and daily-synthesis cron.
 * Returns the new streak value.
 */
export async function computeAndUpdateStreak(userId: string): Promise<number> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_study_date')
    .eq('id', userId)
    .single();

  if (!profile) return 1;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastStudy = profile.last_study_date;

  let newStreak: number;

  if (lastStudy === today) {
    // Already studied today — don't increment again
    newStreak = profile.streak_days || 1;
  } else if (lastStudy === yesterday) {
    // Studied yesterday — continue streak
    newStreak = (profile.streak_days || 0) + 1;
  } else {
    // Gap in studying — reset
    newStreak = 1;
  }

  await supabase
    .from('profiles')
    .update({
      streak_days: newStreak,
      last_study_date: today,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  logger.info('Streak updated', { userId, from: profile.streak_days, to: newStreak });
  return newStreak;
}

/**
 * Called by the daily synthesis cron to reset streaks for inactive users.
 * Only resets if last_study_date is before yesterday.
 */
export async function resetStreakIfInactive(userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_study_date')
    .eq('id', userId)
    .single();

  if (!profile || !profile.last_study_date) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  if (profile.last_study_date < yesterday && (profile.streak_days || 0) > 0) {
    await supabase
      .from('profiles')
      .update({ streak_days: 0, updated_at: new Date().toISOString() })
      .eq('id', userId);
    logger.info('Streak reset due to inactivity', { userId, was: profile.streak_days });
  }
}
