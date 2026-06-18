import type { SeedTemplate, SeedTopicParams, SeedTopicResult, SeedSource, SelectedSeedTemplate } from './types';
import { selectSeedTemplate } from './template-registry';
import { slugify } from './text-utils';
import { upsertAtlasConcepts } from './concept-upserter';
import { logger } from '@/lib/utils/logger';
type SupabaseLike = any;
import { ChapterSeed, MicrotargetSeed } from './types';
import { getChapterSkeleton, getTopicSkeleton, isTopicInChapter, resolveTopicSkeletonForText } from './templates/neet/topic-skeleton';

function isChapterSeed(template: SeedTemplate | ChapterSeed): template is ChapterSeed {
  return 'missions' in template;
}

function normalizeSelectedTemplate(
  _params: SeedTopicParams,
  selectedOrTemplate: SelectedSeedTemplate | SeedTemplate | ChapterSeed,
  templateKey?: string,
  source?: SeedSource
): SelectedSeedTemplate {
  if ('template' in selectedOrTemplate) return selectedOrTemplate;
  return {
    template: selectedOrTemplate,
    templateKey: templateKey ?? ('templateKey' in selectedOrTemplate ? selectedOrTemplate.templateKey : `neet-${selectedOrTemplate.subject.toLowerCase()}-${selectedOrTemplate.chapterSlug}`),
    source: source ?? 'seeded_template',
    confidence: 0.99,
  };
}

function getMicrotargetTopic(mt: MicrotargetSeed, chapterSlug: string) {
  const taxonomyTopicSlug = mt.activeRecallQuestions?.[0]?.taxonomyPath?.topicSlug;
  const topicSlug = taxonomyTopicSlug && isTopicInChapter(taxonomyTopicSlug, chapterSlug)
    ? taxonomyTopicSlug
    : resolveTopicSkeletonForText([mt.title, ...(mt.conceptTags ?? []), ...(mt.ncertAnchors ?? [])].join(' '), chapterSlug)?.slug;

  const topic = topicSlug ? getTopicSkeleton(chapterSlug, topicSlug) : null;
  return {
    topicSlug: topic?.slug ?? topicSlug ?? slugify(mt.title),
    topicTitle: topic?.displayName ?? mt.activeRecallQuestions?.[0]?.taxonomyPath?.topicSlug?.replace(/-/g, ' ') ?? mt.title,
  };
}

function buildSeededTopicRows(
  params: SeedTopicParams,
  selectedOrTemplate: SelectedSeedTemplate | SeedTemplate | ChapterSeed,
  templateKey?: string,
  source?: SeedSource
) {
  const selected = normalizeSelectedTemplate(params, selectedOrTemplate, templateKey, source);
  const selectedTemplate = selected.template;
  const selectedTemplateKey = selected.templateKey;
  const selectedSource = selected.source;
  const { targetMicrotargetSlug } = selected;
  if (isChapterSeed(selectedTemplate)) {
    const rows: any[] = [];
    let globalIndex = 1;
    const targetTopicSlugs = new Set(selected.targetTopicSlugs ?? []);

    for (const mission of selectedTemplate.missions) {
      for (const mt of mission.microtargets) {
        const topicInfo = getMicrotargetTopic(mt, selectedTemplate.chapterSlug);
        if (targetTopicSlugs.size > 0 && !targetTopicSlugs.has(topicInfo.topicSlug)) continue;

        rows.push({
          user_id: params.userId,
          goal_id: params.goalId,
          subject: selectedTemplate.subject,
          chapter: selectedTemplate.chapterTitle,
          topic: topicInfo.topicTitle,
          microtarget: mt.title,
          order_index: globalIndex,
          topic_slug: topicInfo.topicSlug,
          microtarget_slug: slugify(mt.title),
          template_key: selectedTemplateKey,
          source: selectedSource,
          status: 'not_started', // We will set the active one later
          mastery_score: 0,
          confidence: 'low',
          metadata: {
            displayName: selectedTemplate.chapterTitle,
            aliases: selectedTemplate.aliases,
            tags: mt.conceptTags ?? [],
            difficulty: mt.difficulty ?? 'medium',
            microtargets: [mt],
            missionTitle: mission.title,
            missionId: mission.id,
            microtargetId: mt.id,
            ncertChapter: selectedTemplate.chapterTitle,
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
            sourceSubject: selectedTemplate.subject,
            sourceUnit: selectedTemplate.chapterSlug,
            sourceChapter: selectedTemplate.chapterTitle,
          },
        });
        globalIndex++;
      }
    }

    if (rows.length === 0 && targetTopicSlugs.size > 0) {
      return buildSeededTopicRows(params, { ...selected, targetTopicSlugs: undefined });
    }

    if (rows.length === 0) {
      const skeleton = getChapterSkeleton(selectedTemplate.chapterSlug);
      for (const topic of skeleton?.topics ?? []) {
        rows.push({
          user_id: params.userId,
          goal_id: params.goalId,
          subject: selectedTemplate.subject,
          chapter: selectedTemplate.chapterTitle,
          topic: topic.displayName,
          microtarget: `Study ${topic.displayName}`,
          order_index: globalIndex,
          topic_slug: topic.slug,
          microtarget_slug: slugify(topic.displayName),
          template_key: selectedTemplateKey,
          source: selectedSource,
          status: 'not_started',
          mastery_score: 0,
          confidence: 'low',
          metadata: {
            displayName: selectedTemplate.chapterTitle,
            aliases: selectedTemplate.aliases,
            tags: topic.aliases,
            difficulty: 'medium',
            microtargets: [],
            skeletonOnly: true,
            topicSlug: topic.slug,
            ncertChapter: selectedTemplate.chapterTitle,
            estimatedMinutes: 20,
            seededBy: 'neet-topic-skeleton-v1',
            sourceSubject: selectedTemplate.subject,
            sourceUnit: selectedTemplate.chapterSlug,
            sourceChapter: selectedTemplate.chapterTitle,
          },
        });
        globalIndex++;
      }
    }
    
    // Set the active topic
    let activeIndex = 0;
    if (targetMicrotargetSlug) {
      const idx = rows.findIndex(r => r.microtarget_slug === slugify(targetMicrotargetSlug) || r.metadata.microtargetId === targetMicrotargetSlug);
      if (idx !== -1) activeIndex = idx;
    }
    if (rows.length > 0) {
      rows[activeIndex].status = 'active';
    }

    return rows;
  }

  const rows = selectedTemplate.topics.map((item, idx) => {
    const orderIndex = Number.isFinite(item.orderIndex) ? item.orderIndex : idx + 1;
    return {
      user_id: params.userId,
      goal_id: params.goalId,
      subject: selectedTemplate.subject,
      chapter: selectedTemplate.chapter,
      topic: item.topic,
      microtarget: item.microtarget,
      order_index: orderIndex,
      topic_slug: slugify(item.topic),
      microtarget_slug: slugify(item.microtarget),
      template_key: selectedTemplateKey,
      source: selectedSource,
      status: 'not_started',
      mastery_score: 0,
      confidence: 'low',
      metadata: {
        displayName: selectedTemplate.displayName,
        aliases: selectedTemplate.aliases,
        tags: item.tags ?? [],
        difficulty: item.difficulty ?? 'medium',
        microtargets: item.microtargets ?? [],
        seededBy: 'global-topic-seeder-v1',
      },
    };
  });
  
  // Set the active topic
  let activeIndex = 0;
  if (targetMicrotargetSlug) {
    const idx = rows.findIndex(r => r.microtarget_slug === slugify(targetMicrotargetSlug));
    if (idx !== -1) activeIndex = idx;
  }
  if (rows.length > 0) {
    rows[activeIndex].status = 'active';
  }
  
  return rows;
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
  if (!selected) {
    return {
      seeded: 0,
      conceptsSeeded: 0,
      skipped: true,
      templateKey: 'none',
      source: 'unrecognized_domain',
      reason: 'No strict NEET context matched.',
    };
  }

  logger.info('mission_template_selected', {
    userId: params.userId,
    goalId: params.goalId,
    templateKey: selected.templateKey,
    source: selected.source,
  });
  
  const rows = buildSeededTopicRows(params, selected);
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
