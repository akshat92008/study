import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

export async function getLearnerStateVersion(userId: string, client?: any): Promise<number> {
  const supabase = client ?? createAdminClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('learner_state_version')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    logger.warn('Failed to read learner_state_version', { userId, error: error.message });
    return 0;
  }

  return Number(data?.learner_state_version ?? 0);
}

export async function bumpLearnerStateVersion(
  userId: string,
  reason: string,
  sourceEventId?: string | null,
  client?: any
): Promise<number> {
  const supabase = client ?? createAdminClient();
  const current = await getLearnerStateVersion(userId, supabase);
  const nextVersion = current + 1;

  const { error } = await supabase
    .from('profiles')
    .update({
      learner_state_version: nextVersion,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userId);

  if (error) {
    logger.error('Failed to bump learner_state_version', error, {
      userId,
      reason,
      sourceEventId,
    });
    throw new Error(`Failed to bump learner state version: ${error.message}`);
  }

  logger.info('Learner state version bumped', {
    userId,
    from: current,
    to: nextVersion,
    reason,
    sourceEventId,
  });

  return nextVersion;
}
