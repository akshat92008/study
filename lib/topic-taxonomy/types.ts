export type NeetTaxonomyNodeType =
  | "subject"
  | "unit"
  | "chapter"
  | "topic"
  | "subtopic"
  | "concept"
  | "microskill"
  | "error_pattern";

export type NeetTopicNode = {
  id: string;
  slug: string;
  title: string;
  type: NeetTaxonomyNodeType;
  subject: "Physics" | "Chemistry" | "Biology";
  unitSlug: string;
  chapterSlug: string;
  parentSlug?: string;
  path: string[];
  aliases: string[];
  conceptTags: string[];
  ncertAnchors?: string[];
  formulas?: string[];
  reactions?: string[];
  diagrams?: string[];
  examples?: string[];
  pyqPatterns?: string[];
  commonTraps?: string[];
  masteryCriteria?: string[];
};

export type WeakAreaGranularity =
  | "chapter"
  | "topic"
  | "subtopic"
  | "concept"
  | "microskill"
  | "error_pattern";

export type ConceptWeakness = {
  userId: string;
  goalId: string;
  subject: string;
  unitSlug: string;
  chapterSlug: string;
  topicSlug: string;
  subtopicSlug?: string;
  conceptSlug?: string;
  microskillSlug?: string;
  errorPatternSlug?: string;
  displayPath: string[];
  conceptTags: string[];
  severity: "low" | "medium" | "high" | "urgent";
  confidence: number;
  evidenceCount: number;
  lastSeenAt: string;
  missingPoints: string[];
  misconceptionNotes: string[];
  recommendedAction: string;
};
