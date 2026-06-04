// lib/documents/document-types.ts
// Strict type definitions for generated learning documents.
// All AI-generated structured output is normalized into these types.

export type DocumentKind =
  | 'mock_test'          // Full exam simulation (any domain)
  | 'quiz'              // Short knowledge check
  | 'assignment'        // Homework / coursework submission
  | 'mcq_flashcards'
  | 'formula_sheet'
  | 'learning_notes'
  | 'coding_challenge'  // Programming exercises
  | 'essay'             // Written response
  | 'custom';

/**
 * Subject is deliberately an open string, not a closed union,
 * so Cognition OS can handle any domain — not just NEET subjects.
 * Backward-compat alias `NEETSubject` is preserved for legacy code.
 */
export type Subject = string;

/** @deprecated Use Subject (string) instead */
export type NEETSubject = 'Physics' | 'Chemistry' | 'Biology' | 'General';

export type QuestionStatus = 'correct' | 'incorrect' | 'unattempted';

export type AnswerKey = 'A' | 'B' | 'C' | 'D';

export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';

// ── MCQ Question ──────────────────────────────────────────────────────────────

export interface MCQQuestion {
  id: string;
  number: number;
  subject: Subject;
  chapter?: string;
  status?: QuestionStatus;
  question: string;
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
  correctAnswer: AnswerKey;
  explanation?: string;
}

// ── Mock Test Document ────────────────────────────────────────────────────────

export interface MockTestDocument {
  id: string;
  kind: 'mock_test';
  title: string;
  exam: string;
  createdAt: string;
  metadata: {
    totalQuestions: number;
    durationMinutes?: number;
    subjects: string[];
    difficulty?: Difficulty;
  };
  questions: MCQQuestion[];
}

// ── Formula Item ──────────────────────────────────────────────────────────────

export interface FormulaItem {
  name: string;
  formula: string;
  meaning?: string;
  units?: string;
  useWhen?: string;
}

// ── Formula Sheet Document ────────────────────────────────────────────────────

export interface FormulaSheetDocument {
  id: string;
  kind: 'formula_sheet';
  title: string;
  subject?: Subject;
  createdAt: string;
  items: FormulaItem[];
  rawContent?: string;
}

// ── Flashcard Item ────────────────────────────────────────────────────────────

export interface FlashcardItem {
  id: string;
  number: number;
  front: string;
  back: string;
  subject?: Subject;
  chapter?: string;
}

// ── MCQ Flashcards Document ───────────────────────────────────────────────────

export interface MCQFlashcardsDocument {
  id: string;
  kind: 'mcq_flashcards';
  title: string;
  subject?: Subject;
  createdAt: string;
  cards: FlashcardItem[];
}

// ── Document Section ──────────────────────────────────────────────────────────

export interface DocumentSection {
  heading: string;
  content: string;
}

// ── Learning Notes Document ───────────────────────────────────────────────────

export interface LearningNotesDocument {
  id: string;
  kind: 'learning_notes';
  title: string;
  subject?: Subject;
  chapter?: string;
  createdAt: string;
  sections: DocumentSection[];
  rawContent?: string;
}

// ── Union GeneratedDocument ───────────────────────────────────────────────────

export type GeneratedDocument =
  | MockTestDocument
  | FormulaSheetDocument
  | MCQFlashcardsDocument
  | LearningNotesDocument;
