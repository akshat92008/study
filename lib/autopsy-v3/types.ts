export type AssessmentType =
  | 'mock_test'
  | 'practice_test'
  | 'worksheet'
  | 'assignment'
  | 'quiz'
  | 'past_paper'
  | 'custom';

export type AssessmentSource = 'manual' | 'pdf' | 'csv' | 'imported';

export type AssessmentStatus =
  | 'draft'
  | 'extracting'
  | 'needs_review'
  | 'answers_pending'
  | 'diagnosis_pending'
  | 'report_generating'
  | 'report_ready'
  | 'failed';

export type ExtractionStatus =
  | 'not_started'
  | 'uploaded'
  | 'extracting'
  | 'needs_review'
  | 'ready'
  | 'failed'
  | 'manual_entry_required';

export type QuestionStatus = 'correct' | 'incorrect' | 'skipped' | 'unattempted' | 'unknown';

export type MistakeType =
  | 'concept_gap'
  | 'memory_gap'
  | 'silly_error'
  | 'calculation_error'
  | 'misread_question'
  | 'time_pressure'
  | 'poor_elimination'
  | 'guessed'
  | 'weak_application'
  | 'overthinking'
  | 'lack_of_revision'
  | 'unknown';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export type MemoryType =
  | 'mistake_pattern'
  | 'weak_topic'
  | 'behavior_pattern'
  | 'prevention_rule'
  | 'recovery_progress'
  | 'confusion_signal'
  | 'self_reported_weakness'
  | 'time_pressure_pattern'
  | 'confidence_mismatch';

export interface AssessmentRecord {
  id?: string;
  user_id: string;
  goal_id?: string | null;
  title: string;
  assessment_type: AssessmentType;
  source: AssessmentSource;
  total_marks?: number | null;
  scored_marks?: number | null;
  duration_minutes?: number | null;
  taken_at?: string | null;
  status?: AssessmentStatus;
  extraction_status?: ExtractionStatus | null;
  extraction_confidence?: number | null;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface AssessmentQuestionRecord {
  id?: string;
  assessment_id: string;
  user_id: string;
  question_number: number;
  subject?: string | null;
  topic?: string | null;
  subtopic?: string | null;
  question_text?: string | null;
  options?: unknown[] | Record<string, unknown> | null;
  correct_answer?: string | null;
  user_answer?: string | null;
  status?: QuestionStatus;
  marks_awarded?: number | null;
  negative_marks?: number | null;
  difficulty?: 'easy' | 'medium' | 'hard' | 'unknown' | null;
  source_page?: number | null;
  extraction_confidence?: number | null;
  user_reviewed?: boolean;
  metadata?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface MistakeDiagnosisRecord {
  id?: string;
  user_id: string;
  assessment_id?: string | null;
  question_id?: string | null;
  manual_mistake_id?: string | null;
  goal_id?: string | null;
  subject?: string | null;
  topic?: string | null;
  mistake_type: MistakeType;
  user_reason?: string | null;
  user_reason_category?: string | null;
  ai_root_cause?: string | null;
  final_root_cause?: string | null;
  prevention_rule?: string | null;
  fix_strategy?: string | null;
  severity?: Severity;
  confidence?: number;
  status?: 'pending_user_reason' | 'analyzing' | 'ready' | 'fallback_used' | 'failed';
  evidence?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
}

export interface HermesLearningMemoryRecord {
  id?: string;
  user_id: string;
  goal_id?: string | null;
  memory_type: MemoryType;
  subject?: string | null;
  topic?: string | null;
  pattern: string;
  evidence_count?: number;
  severity?: Severity;
  confidence?: number;
  prevention_rule?: string | null;
  first_seen_at?: string;
  last_seen_at?: string;
  next_reminder_condition?: string | null;
  source_refs?: Array<Record<string, unknown>>;
  status?: 'active' | 'resolved' | 'archived';
  created_at?: string;
  updated_at?: string;
}

export interface RepeatedPattern {
  key: string;
  subject: string | null;
  topic: string | null;
  mistakeType: MistakeType;
  rootCause: string;
  count: number;
  priorEvidenceCount: number;
  severity: Severity;
  confidence: number;
  preventionRule: string;
  memoryType: MemoryType;
  sourceQuestionIds: string[];
}

export interface RecoverableMarksEstimate {
  immediately_recoverable: number;
  short_term_recoverable: number;
  long_term_recoverable: number;
  explanation: string;
}

export interface AutopsyReport {
  overview: {
    title: string;
    totalQuestions: number;
    correct: number;
    incorrect: number;
    skipped: number;
    unknown: number;
    score: number | null;
    totalMarks: number | null;
  };
  subjectBreakdown: Array<{ subject: string; total: number; incorrect: number; skipped: number; recoverable: number }>;
  topicBreakdown: Array<{ topic: string; subject: string | null; total: number; incorrect: number; skipped: number; recoverable: number }>;
  mistakeTypeBreakdown: Array<{ mistakeType: MistakeType; count: number; severity: Severity }>;
  repeatedPatterns: RepeatedPattern[];
  highRiskTopics: Array<{ subject: string | null; topic: string; riskScore: number; reason: string }>;
  recoverableMarks: RecoverableMarksEstimate;
  sevenDayProtocol: Array<{ day: number; title: string; action: string }>;
  revisionActions: Array<{ title: string; subject: string | null; topic: string | null; reason: string }>;
  hermesMemoryCandidates: RepeatedPattern[];
  summaryText: string;
}

export interface ExtractionResult {
  rawText: string;
  pages: Array<{ pageNumber: number; text: string }>;
  confidence: number;
  warnings: string[];
}
