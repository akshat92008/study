export type SeedSource = 'seeded_template' | 'custom_seed' | 'ai_seed';
export interface DetailedMicrotarget {
  title: string;
  conceptTags: string[];
  ncertFacts: string[];
  activeRecallQuestions: string[];
  commonTraps: string[];
  masteryCriteria: string[];
  estimatedMinutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
}
export interface SeedTemplateTopic {
  topic: string;
  microtarget: string;
  orderIndex: number;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  microtargets?: DetailedMicrotarget[];
}
export interface SeedTemplate {
  templateKey: string;
  subject: string;
  chapter: string;
  displayName: string;
  aliases: string[];
  topics: SeedTemplateTopic[];
}
export interface SeedTopicParams {
  userId: string;
  goalId: string;
  goalTitle: string;
  goalType?: string | null;
  presetId?: string | null;
  subjects?: string[] | null;
  subject?: string | null;
  domain?: string | null;
  exam?: string | null;
  grade?: string | null;
  board?: string | null;
  chapter?: string | null;
  targetDate?: string | null;
}
export interface SeedTopicResult {
  seeded: number;
  conceptsSeeded: number;
  skipped: boolean;
  templateKey: string;
  source: SeedSource;
  reason?: string;
}
export interface SelectedSeedTemplate {
  template: SeedTemplate | ChapterSeed;
  templateKey: string;
  source: SeedSource;
  confidence: number;
  targetMicrotargetSlug?: string;
  targetTopicSlugs?: string[];
}

export type NeetSubject = "Physics" | "Chemistry" | "Biology";

export type Difficulty = "easy" | "medium" | "hard";

export type ChapterSeed = {
  exam: "NEET";
  syllabusVersion: "NEET_UG_2026";
  subject: NeetSubject;
  unitNumber: number;
  unitTitle: string;
  chapterSlug: string;
  chapterTitle: string;
  classLevel?: "11" | "12" | "mixed";
  aliases: string[];
  ncertMapping: string[];
  prerequisites: string[];
  estimatedHours: number;
  priority: "high" | "medium" | "low";
  missions: MissionSeed[];
};

export type MissionSeed = {
  id: string;
  title: string;
  description: string;
  conceptTags: string[];
  estimatedMinutes: number;
  difficulty: Difficulty;
  microtargets: MicrotargetSeed[];
};

export type MicrotargetSeed = {
  id: string;
  title: string;
  conceptTags: string[];
  ncertAnchors: string[];
  mustKnowFacts: string[];
  formulas?: FormulaSeed[];
  reactions?: ReactionSeed[];
  diagrams?: DiagramSeed[];
  examples?: string[];
  commonTraps: string[];
  activeRecallQuestions: QuestionSeed[];
  pyqPatterns: string[];
  masteryCriteria: string[];
  estimatedMinutes: number;
  difficulty: Difficulty;
};

export type FormulaSeed = {
  name: string;
  expression: string;
  variables: string[];
  units?: string;
  conditions?: string[];
  commonMistakes?: string[];
};

export type ReactionSeed = {
  name: string;
  equation?: string;
  reagentConditions?: string[];
  mechanismTags?: string[];
  tests?: string[];
  commonMistakes?: string[];
};

export type DiagramSeed = {
  name: string;
  labels: string[];
  provesOrShows: string;
  commonLabelTraps: string[];
};

export type ErrorPatternSeed = {
  slug: string;
  trigger: string;
  severity: "low" | "medium" | "high" | "urgent";
  feedback: string;
};

export type TaxonomyPathSeed = {
  subject: "Physics" | "Chemistry" | "Biology";
  unitSlug: string;
  chapterSlug: string;
  topicSlug: string;
  subtopicSlug: string;
  conceptSlug: string;
  microskillSlug: string;
};

export type QuestionSeed = {
  id: string;
  question: string;
  expectedAnswerPoints: string[];
  acceptedSynonyms: string[];
  conceptTags: string[];
  difficulty: Difficulty;
  taxonomyPath?: TaxonomyPathSeed;
  errorPatterns?: ErrorPatternSeed[];
};
