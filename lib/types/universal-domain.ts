/**
 * lib/types/universal-domain.ts
 *
 * Universal domain model for Cognition OS.
 * Supports ANY learning goal: exams, courses, skills, languages, certifications, etc.
 * NEET is ONE preset within this model — not the default identity.
 *
 * Design principles:
 * - All entity types are goal-agnostic
 * - Presets layer domain-specific terminology on top
 * - TypeScript enums kept as string unions for DB compatibility
 */

// ─── Goal Types ───────────────────────────────────────────────────────────────

export type GoalType =
  | 'exam'           // Competitive exam: NEET, JEE, USMLE, Bar, etc.
  | 'course'         // School/college subject or course
  | 'skill'          // Coding, design, data science, etc.
  | 'certification'  // Professional cert: CPA, PMP, AWS, etc.
  | 'language'       // Language learning
  | 'project'        // Project-based learning goal
  | 'custom';        // Free-form, user-defined goal

// ─── Knowledge Unit Types ─────────────────────────────────────────────────────

/**
 * Universal replacement for "chapter" / "topic" / "subject" / "module".
 * The UI can surface the right label based on the preset/goal_type.
 */
export type KnowledgeUnitType =
  | 'subject'          // e.g. "Physics", "History", "Spanish"
  | 'module'           // e.g. "Module 3: Inheritance"
  | 'chapter'          // e.g. "Chapter 5: Chemical Bonding"
  | 'topic'            // e.g. "Newton's Laws"
  | 'concept'          // e.g. "Centripetal Acceleration"
  | 'skill'            // e.g. "Binary Trees", "Verb Conjugation"
  | 'lesson'           // e.g. "Lesson 12: Past Tense"
  | 'resource_section' // e.g. "Page 45-60 of NCERT"
  | 'custom';          // User-defined

// ─── Assessment Types ─────────────────────────────────────────────────────────

/**
 * Universal replacement for "mock_test".
 * "mock_test" remains valid as a sub-type for backward compat.
 */
export type AssessmentType =
  | 'mock_test'         // Full exam simulation
  | 'quiz'              // Short knowledge check
  | 'assignment'        // Homework / coursework
  | 'worksheet'         // Printable practice sheet
  | 'coding_challenge'  // Programming problem
  | 'essay'             // Written submission
  | 'oral_test'         // Speaking/oral examination
  | 'practice_set'      // Curated question set
  | 'custom';           // User-defined

// ─── Universal Mistake Taxonomy ───────────────────────────────────────────────

/**
 * Universal mistake categories — not tied to NEET or any specific exam.
 * Replaces exam-specific mistake tags in the UI copy.
 */
export type UniversalMistakeType =
  | 'conceptual_gap'      // Did not understand the underlying concept
  | 'memory_gap'          // Knew it before, forgot it now
  | 'application_error'   // Concept known; applying it wrong
  | 'process_error'       // Correct approach, procedural mistake
  | 'careless_error'      // Silly/rushed mistake
  | 'time_management'     // Ran out of time
  | 'misread_prompt'      // Misread the question or instructions
  | 'weak_foundation'     // Prerequisite knowledge missing
  | 'expression_error'    // Knows it mentally, can't write/express it correctly
  | 'unknown';            // Unclassifiable

// ─── Goal Presets ─────────────────────────────────────────────────────────────

/**
 * A GoalPreset is a configuration template that gives Cognition OS
 * domain-specific context for a particular learning goal archetype.
 *
 * Presets determine:
 * - Default subjects/modules
 * - Assessment style and scoring model
 * - Common mistake tags
 * - Onboarding questions
 * - Chat system prompt context
 * - Dashboard language overrides
 */
export interface GoalPreset {
  id: string;
  name: string;
  goal_type: GoalType;
  description: string;

  // Knowledge structure
  default_knowledge_unit_type: KnowledgeUnitType;
  default_subjects: string[];          // e.g. ["Physics", "Chemistry"] for NEET

  // Assessment
  assessment_style: AssessmentType;
  scoring_model: ScoringModel;         // How scores are computed/displayed

  // Mistake taxonomy
  common_mistake_tags: UniversalMistakeType[];

  // Onboarding
  onboarding_questions: OnboardingQuestion[];

  // Resources
  recommended_resource_types: string[];

  // AI context
  prompt_context: string;              // Injected into chat system prompt
  dashboard_labels: DashboardLabels;  // UI label overrides for this preset
}

export interface ScoringModel {
  type: 'marks' | 'percentage' | 'grade' | 'level' | 'custom' | 'none';
  max_score?: number;                  // e.g. 720 for NEET — preset-specific
  passing_score?: number;
  label?: string;                      // e.g. "Marks", "Score", "Grade"
  negative_marking?: boolean;
  correct_marks?: number;
  negative_marks?: number;
}

export interface OnboardingQuestion {
  id: string;
  question: string;
  type: 'text' | 'select' | 'multi_select' | 'date' | 'number';
  options?: string[];
  field_key: string;  // Maps to profile/goal field
  required: boolean;
}

export interface DashboardLabels {
  goal_name?: string;          // e.g. "Exam" vs "Course" vs "Goal"
  knowledge_unit?: string;     // e.g. "Chapter" vs "Module" vs "Topic"
  assessment?: string;         // e.g. "Mock Test" vs "Assignment" vs "Quiz"
  score_label?: string;        // e.g. "Marks" vs "Score" vs "Grade"
  target_label?: string;       // e.g. "Target Score" vs "Target Grade" vs "Proficiency Level"
  session_label?: string;      // e.g. "Today's Mission" (universal default)
  weakness_label?: string;     // e.g. "Weak Chapters" vs "Weak Topics"
}

// ─── Built-in Presets Registry ────────────────────────────────────────────────

/**
 * Registry of all built-in presets.
 * NEET is ONE preset in this registry — not the default.
 */
export const GOAL_PRESETS: Record<string, GoalPreset> = {
  // ── Universal defaults (no preset) ──
  custom_learning_goal: {
    id: 'custom_learning_goal',
    name: 'Custom Learning Goal',
    goal_type: 'custom',
    description: 'A free-form, self-defined learning goal.',
    default_knowledge_unit_type: 'topic',
    default_subjects: [],
    assessment_style: 'quiz',
    scoring_model: { type: 'percentage', label: 'Progress' },
    common_mistake_tags: ['conceptual_gap', 'memory_gap', 'careless_error'],
    onboarding_questions: [
      { id: 'goal_title', question: 'What are you trying to learn?', type: 'text', field_key: 'title', required: true },
      { id: 'target_date', question: 'When do you want to achieve this?', type: 'date', field_key: 'target_date', required: false },
      { id: 'current_level', question: 'What is your current level?', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], field_key: 'current_level', required: false },
    ],
    recommended_resource_types: ['notes', 'video', 'practice'],
    prompt_context: 'The user has a custom learning goal. Ask clarifying questions if needed.',
    dashboard_labels: {
      knowledge_unit: 'Topic',
      assessment: 'Quiz / Test',
      score_label: 'Progress',
      target_label: 'Target',
      session_label: "Today's Mission",
    },
  },

  // ── Competitive Exam (generic) ──
  competitive_exam_generic: {
    id: 'competitive_exam_generic',
    name: 'Competitive Exam',
    goal_type: 'exam',
    description: 'Any competitive entrance or qualifying exam.',
    default_knowledge_unit_type: 'chapter',
    default_subjects: [],
    assessment_style: 'mock_test',
    scoring_model: { type: 'marks', label: 'Marks', negative_marking: false },
    common_mistake_tags: ['conceptual_gap', 'time_management', 'misread_prompt', 'careless_error'],
    onboarding_questions: [
      { id: 'exam_name', question: 'Which exam are you preparing for?', type: 'text', field_key: 'title', required: true },
      { id: 'target_date', question: 'When is your exam date?', type: 'date', field_key: 'target_date', required: false },
      { id: 'subjects', question: 'Which subjects does this exam cover?', type: 'text', field_key: 'subjects', required: false },
    ],
    recommended_resource_types: ['textbook', 'pyq', 'mock_test', 'notes'],
    prompt_context: 'The user is preparing for a competitive exam. Focus on exam strategy, time management, and concept clarity.',
    dashboard_labels: {
      knowledge_unit: 'Chapter',
      assessment: 'Mock Test',
      score_label: 'Score',
      target_label: 'Target Score',
      session_label: "Today's Mission",
    },
  },

  // ── School / College Course ──
  school_or_college_course: {
    id: 'school_or_college_course',
    name: 'School / College Course',
    goal_type: 'course',
    description: 'A structured academic course or subject.',
    default_knowledge_unit_type: 'chapter',
    default_subjects: [],
    assessment_style: 'assignment',
    scoring_model: { type: 'percentage', label: 'Grade' },
    common_mistake_tags: ['conceptual_gap', 'weak_foundation', 'careless_error'],
    onboarding_questions: [
      { id: 'course_name', question: 'What course or subject are you studying?', type: 'text', field_key: 'title', required: true },
      { id: 'target_date', question: 'When is your exam or deadline?', type: 'date', field_key: 'target_date', required: false },
    ],
    recommended_resource_types: ['textbook', 'notes', 'assignment'],
    prompt_context: 'The user is studying for an academic course. Help with understanding concepts, assignments, and exam preparation.',
    dashboard_labels: {
      knowledge_unit: 'Chapter',
      assessment: 'Assignment / Test',
      score_label: 'Grade',
      target_label: 'Target Grade',
      session_label: "Today's Study Plan",
    },
  },

  // ── Coding Skill ──
  coding_skill: {
    id: 'coding_skill',
    name: 'Coding / Technical Skill',
    goal_type: 'skill',
    description: 'Learning programming, software engineering, or a technical discipline.',
    default_knowledge_unit_type: 'topic',
    default_subjects: [],
    assessment_style: 'coding_challenge',
    scoring_model: { type: 'level', label: 'Proficiency' },
    common_mistake_tags: ['conceptual_gap', 'application_error', 'process_error'],
    onboarding_questions: [
      { id: 'skill_name', question: 'What skill are you learning? (e.g., Python, Data Structures)', type: 'text', field_key: 'title', required: true },
      { id: 'goal_outcome', question: 'What is your end goal? (e.g., get a job, build a project)', type: 'text', field_key: 'description', required: false },
    ],
    recommended_resource_types: ['documentation', 'coding_challenge', 'project'],
    prompt_context: 'The user is learning a coding or technical skill. Help with code explanations, debugging, and practical exercises.',
    dashboard_labels: {
      knowledge_unit: 'Topic',
      assessment: 'Coding Challenge',
      score_label: 'Proficiency',
      target_label: 'Target Level',
      session_label: "Today's Practice",
    },
  },

  // ── Language Learning ──
  language_learning: {
    id: 'language_learning',
    name: 'Language Learning',
    goal_type: 'language',
    description: 'Learning a new spoken or written language.',
    default_knowledge_unit_type: 'lesson',
    default_subjects: [],
    assessment_style: 'quiz',
    scoring_model: { type: 'level', label: 'Fluency Level' },
    common_mistake_tags: ['memory_gap', 'expression_error', 'careless_error'],
    onboarding_questions: [
      { id: 'language', question: 'Which language are you learning?', type: 'text', field_key: 'title', required: true },
      { id: 'current_level', question: 'What is your current level?', type: 'select', options: ['Complete Beginner', 'A1', 'A2', 'B1', 'B2', 'C1'], field_key: 'current_level', required: true },
    ],
    recommended_resource_types: ['vocabulary', 'grammar', 'speaking_practice'],
    prompt_context: 'The user is learning a language. Focus on vocabulary, grammar, and practical usage in context.',
    dashboard_labels: {
      knowledge_unit: 'Lesson',
      assessment: 'Quiz',
      score_label: 'Fluency',
      target_label: 'Target Level',
      session_label: "Today's Practice",
    },
  },

  // ── NEET UG — preset only, not the default ──
  neet_ug: {
    id: 'neet_ug',
    name: 'NEET UG',
    goal_type: 'exam',
    description: 'National Eligibility cum Entrance Test (Undergraduate) for medical admissions in India.',
    default_knowledge_unit_type: 'chapter',
    default_subjects: ['Physics', 'Chemistry', 'Biology'],
    assessment_style: 'mock_test',
    scoring_model: {
      type: 'marks',
      max_score: 720,
      label: 'Marks',
      negative_marking: true,
      correct_marks: 4,
      negative_marks: 1,
    },
    common_mistake_tags: ['conceptual_gap', 'careless_error', 'time_management', 'memory_gap'],
    onboarding_questions: [
      { id: 'target_date', question: 'When is your NEET exam date?', type: 'date', field_key: 'target_date', required: false },
      { id: 'target_score', question: 'What is your target score? (max 720)', type: 'number', field_key: 'target_score', required: false },
      { id: 'current_level', question: 'Current preparation level?', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], field_key: 'current_level', required: false },
    ],
    recommended_resource_types: ['ncert', 'pyq', 'mock_test', 'notes'],
    prompt_context: 'The user is preparing for NEET UG (Physics, Chemistry, Biology). Focus on NCERT concepts, MCQ strategies, and common NEET patterns.',
    dashboard_labels: {
      knowledge_unit: 'Chapter',
      assessment: 'Mock Test',
      score_label: 'NEET Marks',
      target_label: 'Target Score (out of 720)',
      session_label: "Today's Mission",
      weakness_label: 'Weak Chapters',
    },
  },

  // ── JEE Main ──
  jee_main: {
    id: 'jee_main',
    name: 'JEE Main',
    goal_type: 'exam',
    description: 'Joint Entrance Examination (Main) for engineering admissions in India.',
    default_knowledge_unit_type: 'chapter',
    default_subjects: ['Physics', 'Chemistry', 'Mathematics'],
    assessment_style: 'mock_test',
    scoring_model: { type: 'marks', max_score: 300, label: 'Marks', negative_marking: true },
    common_mistake_tags: ['application_error', 'careless_error', 'time_management'],
    onboarding_questions: [
      { id: 'target_date', question: 'When is your JEE Main date?', type: 'date', field_key: 'target_date', required: false },
      { id: 'target_score', question: 'What is your target score? (max 300)', type: 'number', field_key: 'target_score', required: false },
    ],
    recommended_resource_types: ['textbook', 'pyq', 'mock_test', 'notes'],
    prompt_context: 'The user is preparing for JEE Main (Physics, Chemistry, Mathematics). Focus on problem-solving, derivations, and time-efficient strategies.',
    dashboard_labels: {
      knowledge_unit: 'Chapter',
      assessment: 'Mock Test',
      score_label: 'JEE Score',
      target_label: 'Target Score (out of 300)',
    },
  },
};

// ─── Utility Functions ────────────────────────────────────────────────────────

export function getPreset(presetId: string | null | undefined): GoalPreset {
  if (presetId && GOAL_PRESETS[presetId]) {
    return GOAL_PRESETS[presetId];
  }
  return GOAL_PRESETS.custom_learning_goal;
}

export function getPresetLabel(
  presetId: string | null | undefined,
  key: keyof DashboardLabels,
  fallback: string
): string {
  const preset = getPreset(presetId);
  return preset.dashboard_labels[key] ?? fallback;
}

/**
 * Infer a preset ID from legacy exam_type strings stored in the DB.
 * Allows backward compatibility with profiles that have exam_type = "NEET" or "JEE".
 */
export function inferPresetFromExamType(examType: string | null | undefined): string {
  if (!examType) return 'custom_learning_goal';
  const t = examType.toLowerCase().trim();
  if (t.includes('neet')) return 'neet_ug';
  if (t.includes('jee')) return 'jee_main';
  if (t.includes('general') || t === '') return 'custom_learning_goal';
  // For all other exam types, treat as generic competitive exam
  return 'competitive_exam_generic';
}

/**
 * Get the list of all presets as selectable options for onboarding.
 */
export function getPresetOptions(): Array<{ id: string; name: string; goal_type: GoalType }> {
  return Object.values(GOAL_PRESETS).map(({ id, name, goal_type }) => ({ id, name, goal_type }));
}

// ─── Universal Score / Evidence Types ────────────────────────────────────────

export interface AssessmentScore {
  raw?: number;              // Raw score achieved
  max?: number;              // Maximum possible score
  percentage?: number;       // Computed percentage
  label?: string;            // Human-readable score string, e.g. "480 / 720"
  passing?: number;          // Passing threshold
}

export interface AssessmentAnalysisResult {
  assessmentType: AssessmentType;
  assessmentName: string;
  score?: AssessmentScore;
  totalItems?: number;
  correctCount?: number;
  incorrectCount?: number;
  unattemptedCount?: number;
  mistakes: MistakeDiagnosis[];
  knowledgeUnitLinks: KnowledgeUnitLink[];
  recommendedActions: RecommendedAction[];
  extractionConfidence: number;   // 0-1
  needsUserInput: boolean;
  userInputRequired?: string;     // What input is needed
}

export interface MistakeDiagnosis {
  itemId?: string;
  mistakeType: UniversalMistakeType;
  severity: 'low' | 'medium' | 'high';
  confidence: number;
  description: string;
  rootCause?: string;
  suggestedFix?: string;
}

export interface KnowledgeUnitLink {
  unitType: KnowledgeUnitType;
  unitName: string;
  unitId?: string;
  relationship: 'weak' | 'gap' | 'needs_review' | 'mastered';
}

export interface RecommendedAction {
  type:
    | 'study_new'
    | 'revise_due'
    | 'practice_weakness'
    | 'fix_mistake'
    | 'review_resource'
    | 'take_assessment'
    | 'generate_flashcards'
    | 'generate_summary'
    | 'custom';
  label: string;
  rationale: string;
  estimatedMinutes?: number;
  priority: 'high' | 'medium' | 'low';
  targetUnitName?: string;
  targetUnitId?: string;
}
