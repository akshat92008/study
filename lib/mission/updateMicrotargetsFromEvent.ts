import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';

/**
 * Updates microtargets (daily_microtasks) based on learning events.
 */
export async function updateMicrotargetsFromEvent(
  supabase: SupabaseClient,
  userId: string,
  eventType: string,
  metadata?: any
): Promise<number> {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Find a pending task that matches the event type
    let taskType: string | null = null;
    switch (eventType) {
      case 'source_used':
        taskType = 'concept'; // Or mapping to a specific source task
        break;
      case 'weak_area_detected':
      case 'misconception_detected':
        taskType = 'concept';
        break;
      case 'practice_attempt_submitted':
        taskType = 'practice';
        break;
      case 'revision_card_created':
      case 'revision_reviewed':
        taskType = 'revision';
        break;
    }

    if (!taskType) return 0;

    const { data: task, error: fetchError } = await supabase
      .from('daily_microtasks')
      .select('id')
      .eq('user_id', userId)
      .eq('task_date', today)
      .eq('type', taskType)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();

    if (fetchError || !task) return 0;

    const { error: updateError } = await supabase
      .from('daily_microtasks')
      .update({
        status: 'done',
        completed_at: new Date().toISOString()
      })
      .eq('id', task.id);

    if (updateError) {
      logger.error('Failed to update microtarget', { taskId: task.id, updateError });
      return 0;
    }

    return 1;
  } catch (err) {
    logger.error('Unexpected error in updateMicrotargetsFromEvent', { userId, eventType, error: err });
    return 0;
  }
}
