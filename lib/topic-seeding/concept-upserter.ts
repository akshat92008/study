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
  metadata?: {
    tags?: string[];
  };
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
  const allConceptsToInsert: { subject: string; chapter: string; topic: string; description: string }[] = [];

  for (const row of rows) {
    // Mission level
    allConceptsToInsert.push({ subject: row.subject, chapter: row.chapter, topic: row.topic, description: 'Mission concept' });
    // Microtarget level
    allConceptsToInsert.push({ subject: row.subject, chapter: row.chapter, topic: row.microtarget, description: 'Microtarget concept' });
    // Tags level
    if (row.metadata?.tags) {
      for (const tag of row.metadata.tags) {
        allConceptsToInsert.push({ subject: row.subject, chapter: row.chapter, topic: tag, description: 'Granular concept tag' });
      }
    }
  }

  const uniqueConcepts = uniqueBy(allConceptsToInsert, (c) => `${c.subject}|${c.chapter}|${c.topic}`);

  let createdOrFound = 0;
  for (const concept of uniqueConcepts) {
    try {
      const { data: existing, error: existingError } = await supabase
        .from('concepts')
        .select('id')
        .eq('user_id', params.userId)
        .eq('goal_id', params.goalId)
        .eq('subject', concept.subject)
        .eq('chapter', concept.chapter)
        .eq('topic', concept.topic)
        .limit(1)
        .maybeSingle();

      if (existingError) {
        console.warn('Topic seeding: concept lookup failed', {
          userId: params.userId,
          goalId: params.goalId,
          topic: concept.topic,
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
        subject: concept.subject,
        chapter: concept.chapter,
        topic: concept.topic,
        name: concept.topic,
        description: concept.description,
        mastery: 'not_started',
        mastery_score: 0,
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
          topic: concept.topic,
          error: insertError.message,
        });
        continue;
      }
      createdOrFound += 1;
    } catch (error) {
      console.warn('Topic seeding: concept upsert threw', {
        userId: params.userId,
        goalId: params.goalId,
        topic: concept.topic,
        error,
      });
    }
  }
  return createdOrFound;
}
