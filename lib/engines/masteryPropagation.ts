import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

const PREREQ_BOOST_DECAY = 0.1; // Fraction of mastery boost that propagates to prerequisites

/**
 * Updates mastery for a target concept, then propagates a decayed boost to its prerequisites.
 * Called after a correct flashcard review or a tutor session where the student demonstrates understanding.
 */
export async function propagateMastery(
  userId: string,
  conceptId: string,
  masteryScore: number
): Promise<void> {
  const supabase = await createClient();

  // 1. Update the target concept directly
  await upsertMastery(userId, conceptId, masteryScore);

  // 2. Fetch prerequisites of this concept
  const { data: links } = await supabase
    .from('concept_links')
    .select('source_concept_id')
    .eq('target_concept_id', conceptId)
    .eq('link_type', 'prerequisite');

  if (!links || links.length === 0) return;

  const prereqIds = links.map((l: any) => l.source_concept_id);

  // 3. Fetch current mastery of each prerequisite
  const { data: currentMasteries } = await supabase
    .from('concepts')
    .select('id, mastery_level')
    .in('id', prereqIds)
    .eq('user_id', userId);

  const masteryMap = new Map<string, number>(
    (currentMasteries || []).map((c: any) => [c.id, c.mastery_level ?? 0])
  );

  // 4. Propagate decayed boost to each prerequisite
  await Promise.allSettled(
    prereqIds.map(async (prereqId: string) => {
      const current = masteryMap.get(prereqId) ?? 0;
      // Decayed boost: only a fraction of the child's mastery improvement flows up
      const boost = PREREQ_BOOST_DECAY * (masteryScore - current);
      const updated = Math.min(1, current + Math.max(0, boost));
      await upsertMastery(userId, prereqId, updated);
    })
  );
}

async function upsertMastery(userId: string, conceptId: string, masteryScore: number): Promise<void> {
  const service = new LearnerStateService();
  await service.upsert({
    userId,
    conceptId,
    masteryScore,
    lastUpdated: new Date(),
  });
}

// ── LearnerStateService ───────────────────────────────────────────────────────
// Inline here so the engine is self-contained and testable without circular deps.
export class LearnerStateService {
  async upsert(params: {
    userId: string;
    conceptId: string;
    masteryScore: number;
    lastUpdated: Date;
  }): Promise<void> {
    const supabase = await createClient();
    const { error } = await supabase
      .from('concepts')
      .update({
        mastery_level: params.masteryScore,
        last_reviewed: params.lastUpdated.toISOString(),
      })
      .eq('id', params.conceptId)
      .eq('user_id', params.userId);

    if (error) {
      logger.error('LearnerStateService.upsert failed', { params, error });
    }
  }
}
