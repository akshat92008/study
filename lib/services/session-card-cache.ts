import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { bumpLearnerStateVersion } from '@/lib/services/learner-state-version';

export async function invalidateSessionCards(
  userId: string,
  client?: any,
  reason = 'session_card_invalidation'
): Promise<void> {
  const supabase = client ?? createAdminClient();
  await bumpLearnerStateVersion(userId, reason, null, supabase);

  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const dates = [
    today.toISOString().split('T')[0],
    tomorrow.toISOString().split('T')[0],
  ];

  const { error } = await supabase
    .from('session_cards')
    .delete()
    .eq('user_id', userId)
    .in('date', dates);

  if (error) {
    logger.error('Failed to invalidate session cards', error, { userId, dates });
    throw new Error(`Failed to invalidate session cards: ${error.message}`);
  }
}
