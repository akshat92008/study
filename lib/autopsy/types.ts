export type AutopsyEvidenceStatus =
  | 'verified_mistake'
  | 'verified_correct'
  | 'needs_review'
  | 'pending_review'
  | 'ignored'
  | 'corrected_by_user'
  | 'ignored_or_unverified'; // maintaining compatibility if needed

export type MistakeType =
  | 'conceptual_gap'
  | 'formula_recall'
  | 'calculation_error'
  | 'misread_question'
  | 'option_trap'
  | 'silly_mistake'
  | 'time_pressure'
  | 'forgot_fact'
  | 'application_failure'
  | 'low_confidence_guess'
  | 'unattempted'
  | 'ambiguous'
  | 'out_of_syllabus'
  | 'unknown';

export type EvidenceSource =
  | 'structured_input'
  | 'answer_key'
  | 'marked_pdf'
  | 'image_ocr'
  | 'manual_review'
  | 'chat_practice'
  | 'imported_result'
  | 'autopsy'; // default

export interface AutopsyEvidence {
  evidenceStatus: AutopsyEvidenceStatus;
  mistakeType?: MistakeType;
  confidence: number;
  evidenceSource: EvidenceSource;
  rawEvidence?: any;
}

export function isVerifiedMistake(status: AutopsyEvidenceStatus | string): boolean {
  return status === 'verified_mistake';
}

export function shouldUpdateLearnerState(status: AutopsyEvidenceStatus | string): boolean {
  return status === 'verified_mistake';
}
