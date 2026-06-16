import type { SeedTemplate, SeedTopicParams, SeedTopicResult, SeedSource } from './types';
import { selectSeedTemplate } from './template-registry';
import { slugify } from './text-utils';
import { upsertAtlasConcepts } from './concept-upserter';
import { logger } from '@/lib/utils/logger';
type SupabaseLike = any;
import { ChapterSeed, MicrotargetSeed } from './types';

function isChapterSeed(template: SeedTemplate | ChapterSeed): template is ChapterSeed {
  return 'missions' in template;
}

function buildSeededTopicRows(
  params: SeedTopicParams,
  template: SeedTemplate | ChapterSeed,
  templateKey: string,
  source: SeedSource
) {
  if (isChapterSeed(template)) {
    const rows: any[] = [];
    let globalIndex = 1;

    for (const mission of template.missions) {
      for (const mt of mission.microtargets) {
        rows.push({
          user_id: params.userId,
          goal_id: params.goalId,
          subject: template.subject,
          chapter: template.chapterTitle,
          topic: mission.title,
          microtarget: mt.title,
          order_index: globalIndex,
          topic_slug: slugify(mission.title),
          microtarget_slug: slugify(mt.title),
          template_key: templateKey,
          source,
          status: globalIndex === 1 ? 'active' : 'not_started',
          mastery_score: 0,
          confidence: 'low',
          metadata: {
            displayName: template.chapterTitle,
            aliases: template.aliases,
            tags: mt.conceptTags ?? [],
            difficulty: mt.difficulty ?? 'medium',
            microtargets: [mt],
            missionId: mission.id,
            microtargetId: mt.id,
            ncertChapter: template.chapterTitle,
            ncertAnchors: mt.ncertAnchors,
            conceptTags: mt.conceptTags,
            formulas: mt.formulas,
            reactions: mt.reactions,
            diagrams: mt.diagrams,
            pyqPatterns: mt.pyqPatterns,
            commonTraps: mt.commonTraps,
            masteryCriteria: mt.masteryCriteria,
            activeRecallQuestions: mt.activeRecallQuestions,
            taxonomyPath: mt.activeRecallQuestions?.[0]?.taxonomyPath,
            estimatedMinutes: mt.estimatedMinutes,
            seededBy: 'neet-curated-seeder-v2',
            sourceSubject: template.subject,
            sourceUnit: template.chapterSlug,
            sourceChapter: template.chapterTitle,
          },
        });
        globalIndex++;
      }
    }
    return rows;
  }

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
        microtargets: item.microtargets ?? [],
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
  logger.info('mission_template_selected', {
    userId: params.userId,
    goalId: params.goalId,
    templateKey: selected.templateKey,
    source: selected.source,
  });
  if (selected.source === 'custom_seed') {
    logger.warn('mission_fallback_used', {
      userId: params.userId,
      goalId: params.goalId,
      goalTitle: params.goalTitle,
    });
  }
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
