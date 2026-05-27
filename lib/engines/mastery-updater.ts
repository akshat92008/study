import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export type MasterySource =
  | 'session_close'
  | 'card_review'
  | 'autopsy'
  | 'onboarding'
  | 'tutor_session';

export type MasteryLevel =
  | 'not_started'
  | 'exposed'
  | 'developing'
  | 'proficient'
  | 'mastered'
  | 'automated';

const MASTERY_ORDER: MasteryLevel[] = [
  'not_started', 'exposed', 'developing', 'proficient', 'mastered', 'automated',
];

export function advanceMastery(
  current: MasteryLevel | null,
  understood: boolean
): MasteryLevel {
  const idx = current ? MASTERY_ORDER.indexOf(current) : 0;
  const safeIdx = idx === -1 ? 0 : idx;
  if (!understood) {
    // Regression: drop one tier, floor at 'exposed'
    return MASTERY_ORDER[Math.max(1, safeIdx - 1)];
  }
  // Advance one tier, cap at 'mastered' (automated requires card reviews)
  return MASTERY_ORDER[Math.min(safeIdx + 1, 4)];
}

export async function applyMasteryUpdate(params: {
  userId: string;
  conceptId: string;
  newMastery: MasteryLevel;
  source: MasterySource;
  sourceId?: string;
  evidence?: string;
  useAdminClient?: boolean; // true for background jobs / event consumers
}): Promise<{ oldMastery: MasteryLevel | null; changed: boolean }> {
  const supabase = params.useAdminClient
    ? createAdminClient()
    : await createClient();

  // Fetch current mastery
  const { data: concept, error: fetchErr } = await supabase
    .from('concepts')
    .select('mastery')
    .eq('id', params.conceptId)
    .eq('user_id', params.userId)
    .single();

  if (fetchErr || !concept) {
    logger.warn('applyMasteryUpdate: concept not found', {
      conceptId: params.conceptId,
      userId: params.userId,
    });
    return { oldMastery: null, changed: false };
  }

  const oldMastery = concept.mastery as MasteryLevel;

  // No change needed — skip both writes
  if (oldMastery === params.newMastery) {
    return { oldMastery, changed: false };
  }

  // Update the concept row
  const { error: updateErr } = await supabase
    .from('concepts')
    .update({
      mastery: params.newMastery,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.conceptId)
    .eq('user_id', params.userId);

  if (updateErr) {
    logger.error('applyMasteryUpdate: failed to update concept', { updateErr });
    return { oldMastery, changed: false };
  }

  // Write the evidence trail (non-fatal if this fails)
  const { error: eventErr } = await supabase
    .from('mastery_events')
    .insert({
      user_id: params.userId,
      concept_id: params.conceptId,
      old_mastery: oldMastery,
      new_mastery: params.newMastery,
      source: params.source,
      source_id: params.sourceId ?? null,
      evidence: params.evidence ?? null,
    });

  if (eventErr) {
    logger.warn('applyMasteryUpdate: mastery_events insert failed (non-fatal)', { eventErr });
  }

  logger.info('Mastery updated', {
    userId: params.userId,
    conceptId: params.conceptId,
    from: oldMastery,
    to: params.newMastery,
    source: params.source,
  });

  return { oldMastery, changed: true };
}
