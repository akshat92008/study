// lib/hermes/hermes-types.ts
// Shared input/output types for all Hermes agents.
// No business logic here — pure type definitions.

// ─── SHARED ──────────────────────────────────────────────────────────────────

export type HermesModelTier = 'fast' | 'strong';

export type HermesFeature =
  | 'hermes_mistake'
  | 'hermes_source'
  | 'hermes_revision'
  | 'hermes_trace'
  | 'hermes_next_action'
  | 'hermes_coding';

export type HermesRunInput<T> = {
  userId: string;
  feature: HermesFeature;
  route: string;
  systemPrompt: string;
  userPrompt: string;
  schema: import('zod').ZodSchema<T>;
  modelTier: HermesModelTier;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
};

// ─── MISTAKE AGENT ────────────────────────────────────────────────────────────

export type HermesMistakeInput = {
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
  question: string;
  myAnswer: string;
  correctAnswer: string;
  explanation?: string | null;
  subjectHint?: string | null;
  goalTitle?: string | null;
  recentWeakConcepts?: Array<{
    id?: string;
    subject?: string | null;
    chapter?: string | null;
    topic?: string | null;
    mastery?: string | null;
  }>;
  sourceSnippets?: Array<{
    materialId?: string;
    title?: string;
    text: string;
  }>;
};

export type HermesMistakeCategory =
  | 'conceptual_gap'
  | 'misread'
  | 'calculation_error'
  | 'formula_recall'
  | 'wrong_diagnostic_frame'
  | 'application_error'
  | 'time_pressure'
  | 'silly_error'
  | 'exam_strategy'
  | 'unknown';

export type HermesCardType =
  | 'mistake_concept'
  | 'error_pattern'
  | 'similar_trap'
  | 'formula_recall'
  | 'source_grounded';

export type HermesCardDifficulty = 'easy' | 'medium' | 'hard';

export type HermesCard = {
  front: string;
  back: string;
  type: HermesCardType;
  difficulty: HermesCardDifficulty;
};

export type HermesNextAction = {
  label: string;
  rationale: string;
  estimatedMinutes: number;
  actionType: 'review_cards' | 'practice_similar' | 'read_source' | 'ask_mind' | 'redo_question';
};

export type HermesMistakeResult = {
  category: HermesMistakeCategory;
  subject: string | null;
  chapter: string | null;
  topic: string | null;
  diagnosis: string;
  whyMyAnswerWasWrong: string;
  whyCorrectAnswerWorks: string;
  keyMissedClue: string | null;
  confidence: 'low' | 'medium' | 'high';
  weakConcept: {
    subject: string | null;
    chapter: string | null;
    topic: string | null;
    name: string;
  };
  cards: HermesCard[];
  nextAction: HermesNextAction;
  safetyFlags: {
    possibleHallucination: boolean;
    needsHumanReview: boolean;
    reason?: string;
  };
};

// ─── SOURCE AGENT ─────────────────────────────────────────────────────────────

export type HermesSourceInput = {
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
  materialId: string;
  title: string;
  compactChunks: string[];
  goalTitle?: string | null;
};

export type HermesSourceResult = {
  sourceSummary: string;
  extractedConcepts: Array<{
    subject: string | null;
    chapter: string | null;
    topic: string;
    importance: 'low' | 'medium' | 'high';
  }>;
  suggestedCards: Array<{
    front: string;
    back: string;
    type: 'definition' | 'concept' | 'formula' | 'application';
  }>;
  suggestedPracticePrompts: string[];
  nextAction: {
    label: string;
    rationale: string;
    estimatedMinutes: number;
  };
};

// ─── REVISION AGENT ──────────────────────────────────────────────────────────

export type HermesRevisionInput = {
  userId: string;
  goalId?: string | null;
  draftCards: HermesCard[];
  context: string;
};

export type HermesRevisionResult = {
  improvedCards: HermesCard[];
  rejectedCount: number;
  reason: string;
};

// ─── TRACE AGENT ─────────────────────────────────────────────────────────────

export type HermesTraceInput = {
  userId: string;
  goalId: string;
  recentMistakes: Array<{
    category: string;
    subject?: string | null;
    chapter?: string | null;
    topic?: string | null;
  }>;
  dueCardsCount: number;
  weakConceptsCount: number;
  recentActivity: string[];
};

export type HermesTraceResult = {
  cognitiveTrace: {
    repeatedWeaknesses: string[];
    avoidanceSignals: string[];
    forgettingRisks: string[];
    improvementSignals: string[];
  };
  recommendations: Array<{
    type: 'review' | 'practice' | 'source_read' | 'mistake_repair';
    label: string;
    rationale: string;
  }>;
};

// ─── NEXT-ACTION AGENT ───────────────────────────────────────────────────────

export type HermesNextActionInput = {
  userId: string;
  goalId: string;
  goalTitle: string;
  weakConceptsCount: number;
  dueCardsCount: number;
  recentMistakesCount: number;
  pendingTasksCount: number;
  recentSources: string[];
};

export type HermesNextActionResult = {
  nextAction: {
    label: string;
    actionType: 'review' | 'practice' | 'source' | 'mistake_review' | 'mind_chat';
    rationale: string;
    estimatedMinutes: number;
  };
  microtasks: Array<{
    title: string;
    type: string;
    estimatedMinutes: number;
  }>;
};

// ─── DB WRITER ───────────────────────────────────────────────────────────────

export type WriteMistakeResultInput = {
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
  mistakeInput: HermesMistakeInput;
  hermesResult: HermesMistakeResult;
};

export type WriteMistakeResultOutput = {
  autopsyId: string | null;
  mistakeId: string;
  conceptId: string | null;
  cardIds: string[];
};
