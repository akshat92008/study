/**
 * SESSION CARD INVALIDATION SERVICE
 * ===================================
 * Single entry-point for all state-change events that require a session card
 * to be regenerated.
 *
 * Loop-break contract:
 *   - invalidateSessionCard() bumps learner_state_version, then DELETES the
 *     cache row.  The next GET /api/dashboard/session-card regenerates.
 *   - It does NOT call itself recursively.
 *   - Callers must NOT await this inside a DB trigger or the same RPC that
 *     already bumped learner_state_version — pass `skipVersionBump: true`.
 *
 * Event map (all events that should trigger invalidation):
 *   STUDY_SESSION_COMPLETED       ✓
 *   AUTOPSY_COMPLETED             ✓
 *   REVISION_CARD_REVIEWED        ✓  (only when lapse or significant rating change)
 *   CONCEPT_MASTERY_UPDATED       ✓
 *   LEARNER_STATE_UPDATED         ✓
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import { bumpLearnerStateVersion } from '@/lib/services/learner-state-version';

export type InvalidationReason =
  | 'STUDY_SESSION_COMPLETED'
  | 'AUTOPSY_COMPLETED'
  | 'REVISION_CARD_REVIEWED'
  | 'CONCEPT_MASTERY_UPDATED'
  | 'LEARNER_STATE_UPDATED'
  | 'session_card_invalidation'        // generic / legacy
  | 'revision_cards_generated'
  | 'mistake_revision_card_created'
  | 'revision_card_created'
  | 'revision_repeated_failure_task_created'
  | 'concept_mastery_recomputed'
  | 'chat_replan_removed_tasks'
  | 'chat_replan_lightened_intensity'
  | 'chat_replan_added_recovery_break'
  | 'chat_planner_tasks_updated';

export interface InvalidateOptions {
  /**
   * When true, skip the learner_state_version bump.
   * Use this when the calling RPC/trigger already bumped it to avoid
   * double-increment races.
   */
  skipVersionBump?: boolean;
  /**
   * Optional source event UUID for audit trail.
   */
  sourceEventId?: string | null;
  /**
   * Optional Supabase client. When omitted, an admin client is created.
   */
  client?: any;
  /**
   * Optional Goal ID to scope invalidation to a specific goal.
   */
  goalId?: string | null;
}

/**
 * Invalidate today's (and tomorrow's) session card for a user.
 *
 * Safe to call from:
 *   - API route handlers
 *   - Event consumers (worker.ts)
 *   - Revision engine
 *   - Autopsy engine
 *
 * NOT safe to call from:
 *   - DB triggers (would require supabase.rpc, not this TS function)
 *   - Inside complete_study_session RPC (it already deletes the row directly)
 */
export async function invalidateSessionCard(
  userId: string,
  reason: InvalidationReason = 'session_card_invalidation',
  options: InvalidateOptions = {}
): Promise<void> {
  const { skipVersionBump = false, sourceEventId = null, client } = options;
  const supabase = client ?? createAdminClient();

  // 1. Bump version (unless caller already did it)
  if (!skipVersionBump) {
    try {
      await bumpLearnerStateVersion(userId, reason, sourceEventId, supabase);
    } catch (err) {
      logger.error('invalidateSessionCard: failed to bump learner state version', err, {
        userId,
        reason,
      });
      throw err;
    }
  }

  // 2. Delete today + tomorrow cards
  const today = new Date();
  const tomorrow = new Date(Date.now() + 86_400_000);
  const dates = [
    today.toISOString().split('T')[0],
    tomorrow.toISOString().split('T')[0],
  ];

  let deleteQuery = supabase
    .from('session_cards')
    .delete()
    .eq('user_id', userId)
    .in('date', dates);

  if (options.goalId) {
    deleteQuery = deleteQuery.eq('goal_id', options.goalId);
  }

  const { error } = await deleteQuery;

  if (error) {
    logger.error('invalidateSessionCard: failed to delete session_cards rows', error, {
      userId,
      dates,
      reason,
    });
    throw new Error(`Failed to invalidate session cards: ${error.message}`);
  }

  logger.info('Session card invalidated', { userId, dates, reason, skipVersionBump });
}

/**
 * Mark the session card for today as completed.
 * Called after a study session, autopsy, or revision session ends.
 */
export async function markSessionCardCompleted(
  userId: string,
  localDate: string,
  options: { client?: any } = {}
): Promise<void> {
  const supabase = options.client ?? createAdminClient();

  const { error } = await supabase
    .from('session_cards')
    .update({
      isCompleted: true,
      completedAt: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('date', localDate)
    .eq('isCompleted', false); // idempotent: only update if not already done

  if (error) {
    logger.warn('markSessionCardCompleted: failed', { userId, localDate, error: error.message });
    // Non-fatal — don't throw
  }
}

// ─── Re-export for backward compatibility with existing engine imports ────────
// (the old name was `invalidateSessionCards` plural)
export const invalidateSessionCards = (
  userId: string,
  client?: any,
  reason: InvalidationReason = 'session_card_invalidation'
): Promise<void> =>
  invalidateSessionCard(userId, reason, { client, skipVersionBump: false });
