import { SupabaseClient } from '@supabase/supabase-js';
import { logger } from '@/lib/utils/logger';
import type { LearningSignal } from './extractLearningSignals';
import { upsertConceptFromSignal } from '@/lib/atlas/upsertConceptFromSignal';
import { updateMasteryFromSignal } from '@/lib/atlas/updateMasteryFromSignal';
import { createRevisionCardFromSignal } from '@/lib/memory/createRevisionCardFromSignal';
import { updateMicrotargetsFromEvent } from '@/lib/mission/updateMicrotargetsFromEvent';

export interface LearningMutationSummary {
  eventsWritten: number;
  conceptsCreated: number;
  conceptsUpdated: number;
  revisionCardsCreated: number;
  microtargetsUpdated: number;
  warnings: string[];
}

/**
 * Applies learning signals to durable backend state.
 */
export async function applyLearningSignals(
  supabase: SupabaseClient,
  userId: string,
  signals: LearningSignal[],
  options: {
    goalId?: string | null;
    source: string;
  }
): Promise<LearningMutationSummary> {
  const summary: LearningMutationSummary = {
    eventsWritten: 0,
    conceptsCreated: 0,
    conceptsUpdated: 0,
    revisionCardsCreated: 0,
    microtargetsUpdated: 0,
    warnings: []
  };

  try {
    for (const signal of signals) {
      let conceptId: string | null = null;

      // 1. Handle concept-based signals
      if ('concept' in signal && signal.concept) {
        conceptId = await upsertConceptFromSignal(supabase, {
          userId,
          conceptName: signal.concept,
          goalId: options.goalId
        });

        if (conceptId) {
          summary.conceptsCreated++;

          // Update mastery
          const masteryRes = await updateMasteryFromSignal(supabase, userId, conceptId, signal);
          if (masteryRes) summary.conceptsUpdated++;

          // Create revision card
          const cardId = await createRevisionCardFromSignal(supabase, userId, conceptId, signal);
          if (cardId) summary.revisionCardsCreated++;
        }
      }

      // 2. Write Agent Action (Learning Event)
      const { error: actionError } = await supabase.from('agent_actions').insert({
        user_id: userId,
        agent_name: 'mind',
        action_type: signal.type,
        status: 'applied',
        risk_level: 'safe_auto',
        evidence: {
          signal,
          options,
          conceptId
        },
        metadata: {
          source: options.source,
          goalId: options.goalId
        }
      });

      if (!actionError) summary.eventsWritten++;

      // 3. Update Microtargets
      const microCount = await updateMicrotargetsFromEvent(supabase, userId, signal.type);
      summary.microtargetsUpdated += microCount;
    }

    return summary;
  } catch (err) {
    logger.error('applyLearningSignals failed', { userId, signals, error: err });
    summary.warnings.push('Failed to apply some learning signals.');
    return summary;
  }
}
