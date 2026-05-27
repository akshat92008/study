import { createClient } from '@/lib/supabase/server';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventTypes } from '@/lib/events/types';
import { traversePrerequisites } from '@/lib/atlas/prerequisiteTraversal';
import { v4 as uuidv4 } from 'uuid';

export type MasteryEvidence =
  | { type: 'correct_answer'; strength: number; sourceId: string }
  | { type: 'wrong_answer'; strength: number; sourceId: string }
  | { type: 'session_completed'; strength: number; sourceId: string }
  | { type: 'card_review'; rating: 'again' | 'hard' | 'good' | 'easy'; sourceId: string };

/**
 * Apply a piece of evidence to a user's mastery of a concept.
 * Steps:
 *   1️⃣ Load (or create) the current mastery row.
 *   2️⃣ Convert the evidence into a bounded delta [-0.1, +0.1].
 *   3️⃣ Apply prerequisite boosts/penalties.
 *   4️⃣ Persist the updated mastery and a confidence snapshot.
 *   5️⃣ Publish ATLAS_MASTERY_UPDATED event.
 */
export async function applyMasteryEvidence(input: {
  userId: string;
  conceptId: string;
  evidence: MasteryEvidence;
}) {
  const supabase = await createClient();

  // ---------- 1. Load or create mastery row ----------
  const { data: existing, error: loadErr } = await supabase
    .from('concept_mastery')
    .select('*')
    .eq('user_id', input.userId)
    .eq('concept_id', input.conceptId)
    .single();

  if (loadErr && loadErr.code !== 'PGRST116') {
    // PGRST116 = No rows returned – we will create a new one
    throw loadErr;
  }

  const masteryRow = existing ?? {
    id: uuidv4(),
    user_id: input.userId,
    concept_id: input.conceptId,
    mastery_score: 0,
    confidence: 0,
  };

  // ---------- 2. Evidence → delta ----------
  const evidenceDeltaMap: Record<string, number> = {
    correct_answer: 0.07,
    wrong_answer: -0.09,
    session_completed: 0.05,
    // card_review will be handled separately
  };

  let delta = 0;
  if (input.evidence.type === 'card_review') {
    const ratingMap = { again: -0.12, hard: -0.06, good: 0.04, easy: 0.08 } as const;
    delta = ratingMap[input.evidence.rating];
  } else {
    delta = evidenceDeltaMap[input.evidence.type] * (input.evidence.strength ?? 1);
  }

  // Clamp delta to reasonable bounds
  delta = Math.max(-0.12, Math.min(0.12, delta));

  // ---------- 3. Prerequisite boost/penalty ----------
  const prerequisites = await traversePrerequisites(input.conceptId);
  const boostFactor = 0.4; // positive evidence also boosts prerequisites
  const penaltyFactor = 0.6; // negative evidence penalises dependents

  // Apply to current concept
  let newScore = masteryRow.mastery_score + delta;
  newScore = Math.max(0, Math.min(1, newScore));

  // Update prerequisites (if any) – simple additive boost/penalty
  const updates: Promise<any>[] = [];
  for (const preId of prerequisites) {
    const { data: preRow, error: preErr } = await supabase
      .from('concept_mastery')
      .select('*')
      .eq('user_id', input.userId)
      .eq('concept_id', preId)
      .single();
    const row = preRow ?? {
      id: uuidv4(),
      user_id: input.userId,
      concept_id: preId,
      mastery_score: 0,
      confidence: 0,
    };
    const adj = delta > 0 ? delta * boostFactor : delta * penaltyFactor;
    const updatedScore = Math.max(0, Math.min(1, row.mastery_score + adj));
    updates.push(
      supabase
        .from('concept_mastery')
        .upsert({ ...row, mastery_score: updatedScore }, { onConflict: ['id'] })
    );
  }

  // ---------- 4. Persist mastery & confidence ----------
  // Simple confidence update: EMA with alpha = 0.3
  const newConfidence = 0.7 * (masteryRow.confidence ?? 0) + 0.3 * Math.abs(delta);

  const { error: upsertErr } = await supabase.from('concept_mastery').upsert(
    { ...masteryRow, mastery_score: newScore, confidence: newConfidence },
    { onConflict: ['id'] }
  );

  if (upsertErr) throw upsertErr;

  // Log evidence
  await supabase.from('mastery_evidence_log').insert({
    id: uuidv4(),
    mastery_id: masteryRow.id,
    evidence_type: input.evidence.type,
    strength: delta,
    source_id: input.evidence.sourceId,
  });

  // Confidence audit (optional)
  await supabase.from('mastery_confidence').insert({
    id: uuidv4(),
    mastery_id: masteryRow.id,
    confidence: newConfidence,
    reason: `Applied ${input.evidence.type}`,
  });

  // Wait for prerequisite updates
  await Promise.all(updates);

  // ---------- 5. Publish event ----------
  await EventDispatcher.publish({
    userId: input.userId,
    type: 'ATLAS_MASTERY_UPDATED' as keyof typeof EventTypes,
    source: 'service',
    data: {
      conceptId: input.conceptId,
      newMastery: newScore,
      confidence: newConfidence,
    },
    idempotencyKey: uuidv4(),
  });
}
