import type { SeedTopicParams } from './types';
type SupabaseLike = any;
interface SeededTopicRow {
  subject: string;
  chapter: string;
  topic: string;
  microtarget: string;
  template_key: string;
  source: string;
  order_index: number;
}
function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
export async function upsertAtlasConcepts(
  supabase: SupabaseLike,
  params: SeedTopicParams,
  rows: SeededTopicRow[]
): Promise<number> {
  const uniqueTopics = uniqueBy(rows, (row) => `${row.subject}|${row.chapter}|${row.topic}`);
  let createdOrFound = 0;
  for (const row of uniqueTopics) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from('concepts')
        .select('id')
        .eq('user_id', params.userId)
        .eq('goal_id', params.goalId)
        .eq('subject', row.subject)
        .eq('chapter', row.chapter)
        .eq('topic', row.topic)
        .limit(1)
        .maybeSingle();
      if (existingError) {
        console.warn('Topic seeding: concept lookup failed', {
          userId: params.userId,
          goalId: params.goalId,
          topic: row.topic,
          error: existingError.message,
        });
        continue;
      }
      if (existing?.id) {
        createdOrFound += 1;
        continue;
      }
      const payload: Record<string, unknown> = {
        user_id: params.userId,
        goal_id: params.goalId,
        subject: row.subject,
        chapter: row.chapter,
        topic: row.topic,
        name: row.topic,
        description: row.microtarget,
        mastery: 'not_started',
        mastery_level: 0,
        mastery_tier: 'unknown',
        confidence: 'low',
        forgetting_probability: 1,
        retention_strength: 0,
        exposure_count: 0,
        correct_count: 0,
      };
      const { error: insertError } = await supabase.from('concepts').insert(payload);
      if (insertError) {
        console.warn('Topic seeding: concept insert failed', {
          userId: params.userId,
          goalId: params.goalId,
          topic: row.topic,
          error: insertError.message,
        });
        continue;
      }
      createdOrFound += 1;
    } catch (error) {
      console.warn('Topic seeding: concept upsert threw', {
        userId: params.userId,
        goalId: params.goalId,
        topic: row.topic,
        error,
      });
    }
  }
  return createdOrFound;
}
