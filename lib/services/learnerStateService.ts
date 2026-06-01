import { LearnerState } from '@/lib/models/learnerState';
import { createClient } from '@/lib/supabase/server';

export class LearnerStateService {
  /** Upsert a learner's mastery for a concept */
  async upsert(state: LearnerState): Promise<void> {
    const supabase = await createClient();
    await supabase
      .from('learner_states')
      .upsert({
        user_id: state.userId,
        concept_id: state.conceptId,
        mastery_score: state.masteryScore,
        last_updated: state.lastUpdated.toISOString(),
      }, { onConflict: 'user_id,concept_id' });
  }

  /** Retrieve mastery scores for a learner */
  async getForUser(userId: string): Promise<LearnerState[]> {
    const supabase = await createClient();
    const { data } = await supabase
      .from('learner_states')
      .select('user_id, concept_id, mastery_score, last_updated')
      .eq('user_id', userId);

    return (data || []).map((row: any) => ({
      userId: row.user_id,
      conceptId: row.concept_id,
      masteryScore: Number(row.mastery_score ?? 0),
      lastUpdated: row.last_updated ? new Date(row.last_updated) : new Date(),
    }));
  }
}
