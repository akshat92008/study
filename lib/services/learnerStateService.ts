import { db } from '@/lib/db';
import { learnerState } from '@/lib/db/learnerState';
import { LearnerState } from '@/lib/models/learnerState';
import { eq } from 'drizzle-orm';

export class LearnerStateService {
  /** Upsert a learner's mastery for a concept */
  async upsert(state: LearnerState): Promise<void> {
    await db
      .insert(learnerState)
      .values({
        userId: state.userId,
        conceptId: state.conceptId,
        masteryScore: state.masteryScore.toString(),
        lastUpdated: state.lastUpdated,
      })
      .onConflictDoUpdate({
        target: [learnerState.userId, learnerState.conceptId],
        set: {
          masteryScore: state.masteryScore.toString(),
          lastUpdated: state.lastUpdated,
        },
      });
  }

  /** Retrieve mastery scores for a learner */
  async getForUser(userId: string): Promise<LearnerState[]> {
    const rows = await db.select().from(learnerState).where(eq(learnerState.userId, userId));
    return rows.map((r: any) => ({
      userId: r.userId,
      conceptId: r.conceptId,
      masteryScore: Number(r.masteryScore),
      lastUpdated: r.lastUpdated,
    }));
  }
}
