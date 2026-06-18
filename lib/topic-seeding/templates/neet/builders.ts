import { ChapterSeed, MissionSeed, MicrotargetSeed, FormulaSeed, ReactionSeed, DiagramSeed, QuestionSeed } from '../../types';
import { NeetUgUnit } from '../../../syllabus/neet-ug-2026';
import { getChapterTopicSlugs, isPlaceholderTitle, isPlaceholderQuestion, isTopicInChapter, resolveTopicSkeletonForText } from './topic-skeleton';

export interface ChapterData {
  missions: MissionData[];
}

export interface MissionData {
  title: string;
  description: string;
  conceptTags: string[];
  estimatedMinutes: number;
  difficulty: "easy" | "medium" | "hard";
  microtargets: MicrotargetData[];
}

export interface MicrotargetData {
  title: string;
  conceptTags: string[];
  ncertAnchors: string[];
  mustKnowFacts: string[];
  formulas?: FormulaSeed[];
  reactions?: ReactionSeed[];
  diagrams?: DiagramSeed[];
  examples?: string[];
  commonTraps: string[];
  activeRecallQuestions: QuestionData[];
  pyqPatterns: string[];
  masteryCriteria: string[];
  estimatedMinutes: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface QuestionData {
  question: string;
  expectedAnswerPoints: string[];
  acceptedSynonyms: string[];
  conceptTags: string[];
  difficulty: "easy" | "medium" | "hard";
  errorPatterns?: any[];
  /** If present in JSON data, this is the source-of-truth taxonomy path */
  taxonomyPath?: {
    subject: string;
    unitSlug: string;
    chapterSlug: string;
    topicSlug: string;
    subtopicSlug: string;
    conceptSlug: string;
    microskillSlug: string;
  };
}

function slugifyTaxonomyPart(value: string | null | undefined, fallback: string): string {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return slug || fallback;
}

export function buildChapterSeed(unit: NeetUgUnit, data: ChapterData): ChapterSeed {
  const shouldScopeToSkeleton = unit.chapterSlug.startsWith('human-physiology-');

  // Filter missions: remove missions where ALL microtargets are placeholders
  const filteredMissions = data.missions
    .map((m, mIndex) => {
      const missionId = `${unit.chapterSlug}-m-${mIndex}`;

      // Filter out placeholder microtargets
      const realMicrotargets = m.microtargets.filter((mt) => {
        if (isPlaceholderTitle(mt.title)) return false;
        if (!shouldScopeToSkeleton) return true;
        return Boolean(resolveTopicSkeletonForText(
          [mt.title, ...(mt.conceptTags ?? []), ...(mt.ncertAnchors ?? [])].join(' '),
          unit.chapterSlug
        ));
      });

      if (realMicrotargets.length === 0) return null; // Skip entirely empty missions

      return {
        id: missionId,
        title: m.title,
        description: m.description,
        conceptTags: m.conceptTags,
        estimatedMinutes: m.estimatedMinutes,
        difficulty: m.difficulty,
        microtargets: realMicrotargets.map((mt, mtIndex) => {
          const microtargetId = `${unit.chapterSlug}-mt-${mIndex}-${mtIndex}`;

          // Filter out placeholder questions
          const realQuestions = mt.activeRecallQuestions.filter(q => !isPlaceholderQuestion(q.question));
          const resolvedTopic = resolveTopicSkeletonForText(
            [mt.title, ...(mt.conceptTags ?? []), ...(mt.ncertAnchors ?? [])].join(' '),
            unit.chapterSlug
          );

          return {
            id: microtargetId,
            title: mt.title,
            conceptTags: mt.conceptTags,
            ncertAnchors: mt.ncertAnchors,
            mustKnowFacts: mt.mustKnowFacts,
            formulas: mt.formulas,
            reactions: mt.reactions,
            diagrams: mt.diagrams,
            examples: mt.examples,
            commonTraps: mt.commonTraps,
            activeRecallQuestions: realQuestions.map((q, qIndex) => {
              const existingPath = q.taxonomyPath;
              const existingTopicSlug = existingPath?.topicSlug;
              const fallbackTopicSlug = getChapterTopicSlugs(unit.chapterSlug)[0] ?? unit.chapterSlug;
              const topicSlug = resolvedTopic?.slug
                ?? (existingTopicSlug && isTopicInChapter(existingTopicSlug, unit.chapterSlug) ? existingTopicSlug : fallbackTopicSlug);
              const subtopicSlug = slugifyTaxonomyPart(existingPath?.subtopicSlug, slugifyTaxonomyPart(mt.title, `subtopic-${mtIndex}`));
              const conceptSlug = slugifyTaxonomyPart(existingPath?.conceptSlug ?? q.conceptTags[0], 'concept');
              const microskillSlug = slugifyTaxonomyPart(existingPath?.microskillSlug, `skill-${qIndex}`);

              return {
                id: `${unit.chapterSlug}-q-${mIndex}-${mtIndex}-${qIndex}`,
                question: q.question,
                expectedAnswerPoints: q.expectedAnswerPoints,
                acceptedSynonyms: q.acceptedSynonyms,
                conceptTags: q.conceptTags,
                difficulty: q.difficulty,
                taxonomyPath: {
                  subject: unit.subject,
                  unitSlug: unit.chapterSlug,
                  chapterSlug: unit.chapterSlug,
                  topicSlug: topicSlug,
                  subtopicSlug: subtopicSlug,
                  conceptSlug: conceptSlug,
                  microskillSlug: microskillSlug
                },
                errorPatterns: q.errorPatterns
              };
            }),
            pyqPatterns: mt.pyqPatterns,
            masteryCriteria: mt.masteryCriteria,
            estimatedMinutes: mt.estimatedMinutes,
            difficulty: mt.difficulty
          };
        })
      };
    })
    .filter((m): m is NonNullable<typeof m> => m !== null);

  return {
    exam: "NEET",
    syllabusVersion: "NEET_UG_2026",
    subject: unit.subject,
    unitNumber: unit.unitNumber,
    unitTitle: unit.unitTitle,
    chapterSlug: unit.chapterSlug,
    chapterTitle: unit.unitTitle,
    classLevel: unit.classLevel === 'mixed' ? undefined : unit.classLevel,
    aliases: unit.aliases,
    ncertMapping: unit.ncertMapping,
    prerequisites: [],
    estimatedHours: filteredMissions.reduce((acc, m) => acc + m.estimatedMinutes, 0) / 60,
    priority: "high",
    missions: filteredMissions
  };
}
