import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

export async function invalidateSessionCards(userId: string, client?: any): Promise<void> {
  const supabase = client ?? createAdminClient();
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
