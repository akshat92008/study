import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

/**
 * Single source of truth for streak logic.
 * Call this from both session-close route and daily-synthesis cron.
 * Returns the new streak value.
 */
export async function computeAndUpdateStreak(userId: string, client?: any): Promise<number> {
  const supabase = client ?? (await createClient());

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_active_at')
    .eq('id', userId)
    .single();

  if (!profile) return 1;

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const lastActiveDate = profile.last_active_at ? String(profile.last_active_at).split('T')[0] : null;

  let newStreak: number;

  if (lastActiveDate === today) {
    // Already active today — don't increment again
    newStreak = Math.max(profile.streak_days || 1, 1);
  } else if (lastActiveDate === yesterday) {
    // Active yesterday — continue streak
    newStreak = (profile.streak_days || 0) + 1;
  } else {
    // Gap in activity — reset
    newStreak = 1;
  }

  await supabase
    .from('profiles')
    .update({
      streak_days: newStreak,
      last_active_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  logger.info('Streak updated', { userId, from: profile.streak_days, to: newStreak });
  return newStreak;
}

/**
 * Called by the daily synthesis cron to reset streaks for inactive users.
 * Only resets if the latest completed study session is before yesterday.
 */
export async function resetStreakIfInactive(userId: string): Promise<void> {
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from('profiles')
    .select('streak_days, last_active_at')
    .eq('id', userId)
    .single();

  if (!profile || !profile.last_active_at) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
  const lastActiveDate = String(profile.last_active_at).split('T')[0];

  if (lastActiveDate < yesterday && (profile.streak_days || 0) > 0) {
    await supabase
      .from('profiles')
      .update({ streak_days: 0, updated_at: new Date().toISOString() })
      .eq('id', userId);
    logger.info('Streak reset due to inactivity', { userId, was: profile.streak_days });
  }
}
