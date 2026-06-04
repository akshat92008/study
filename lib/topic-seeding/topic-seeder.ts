import type { SeedTemplate, SeedTopicParams, SeedTopicResult, SeedSource } from './types';
import { selectSeedTemplate } from './template-registry';
import { slugify } from './text-utils';
import { upsertAtlasConcepts } from './concept-upserter';
type SupabaseLike = any;
function buildSeededTopicRows(
  params: SeedTopicParams,
  template: SeedTemplate,
  templateKey: string,
  source: SeedSource
) {
  return template.topics.map((item, idx) => {
    const orderIndex = Number.isFinite(item.orderIndex) ? item.orderIndex : idx + 1;
    return {
      user_id: params.userId,
      goal_id: params.goalId,
      subject: template.subject,
      chapter: template.chapter,
      topic: item.topic,
      microtarget: item.microtarget,
      order_index: orderIndex,
      topic_slug: slugify(item.topic),
      microtarget_slug: slugify(item.microtarget),
      template_key: templateKey,
      source,
      status: orderIndex === 1 ? 'active' : 'not_started',
      mastery_score: 0,
      confidence: 'low',
      metadata: {
        displayName: template.displayName,
        aliases: template.aliases,
        tags: item.tags ?? [],
        difficulty: item.difficulty ?? 'medium',
        seededBy: 'global-topic-seeder-v1',
      },
    };
  });
}
export async function seedTopicsForGoal(
  supabase: SupabaseLike,
  params: SeedTopicParams
): Promise<SeedTopicResult> {
  if (!params.userId || !params.goalId || !params.goalTitle) {
    return {
      seeded: 0,
      conceptsSeeded: 0,
      skipped: true,
      templateKey: 'none',
      source: 'custom_seed',
      reason: 'missing_required_params',
    };
  }
  const selected = selectSeedTemplate(params);
  const rows = buildSeededTopicRows(params, selected.template, selected.templateKey, selected.source);
  const { error: upsertError } = await supabase
    .from('seeded_topics')
    .upsert(rows, {
      onConflict: 'user_id,goal_id,template_key,topic_slug,microtarget_slug',
      ignoreDuplicates: false,
    });
  if (upsertError) {
    console.error('Global topic seeding failed', {
      userId: params.userId,
      goalId: params.goalId,
      templateKey: selected.templateKey,
      error: upsertError.message,
    });
    return {
      seeded: 0,
      conceptsSeeded: 0,
      skipped: true,
      templateKey: selected.templateKey,
      source: selected.source,
      reason: upsertError.message,
    };
  }
  const conceptsSeeded = await upsertAtlasConcepts(supabase, params, rows);
  return {
    seeded: rows.length,
    conceptsSeeded,
    skipped: false,
    templateKey: selected.templateKey,
    source: selected.source,
  };
}
export const __topicSeedingInternals = {
  buildSeededTopicRows,
  selectSeedTemplate,
};
