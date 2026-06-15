import { ChapterSeed, MissionSeed, MicrotargetSeed, FormulaSeed, ReactionSeed, DiagramSeed, QuestionSeed } from '../../../types';
import { NeetUgUnit } from '../../../../syllabus/neet-ug-2026';

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
}

export function buildChapterSeed(unit: NeetUgUnit, data: ChapterData): ChapterSeed {
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
    estimatedHours: data.missions.reduce((acc, m) => acc + m.estimatedMinutes, 0) / 60,
    priority: "high",
    missions: data.missions.map((m, mIndex) => {
      const missionId = `${unit.chapterSlug}-m-${mIndex}`;
      return {
        id: missionId,
        title: m.title,
        description: m.description,
        conceptTags: m.conceptTags,
        estimatedMinutes: m.estimatedMinutes,
        difficulty: m.difficulty,
        microtargets: m.microtargets.map((mt, mtIndex) => {
          const microtargetId = `${unit.chapterSlug}-mt-${mIndex}-${mtIndex}`;
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
            activeRecallQuestions: mt.activeRecallQuestions.map((q, qIndex) => {
              // Extract subtopic slug from microtarget title, concept from question
              const subtopicSlug = mt.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              const conceptSlug = q.conceptTags[0]?.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'concept';

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
                  topicSlug: missionId,
                  subtopicSlug: subtopicSlug,
                  conceptSlug: conceptSlug,
                  microskillSlug: `skill-${qIndex}`
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
  };
}
