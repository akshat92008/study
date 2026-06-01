export type ChatUploadIntent =
  | 'study_material_index'
  | 'one_turn_document_read'
  | 'autopsy_mock_analysis'
  | 'unsupported';

const STUDY_MATERIAL_RE =
  /\b(use this|save this|upload this|index this|store this|add this|my notes|study material|ncert|textbook|chapter|pdf|source|answer from this|use later|prescribed material|according to this|make this my source)\b/i;

const AUTOPSY_RE =
  /\b(mock|test|answer key|omr|marks|score|mistake|wrong questions|autopsy|analy[sz]e my paper|graded paper|question paper|response sheet|solutions?)\b/i;

const ONE_TURN_READ_RE =
  /\b(read this|explain this document|summarize this document|what does this pdf say|extract this|explain this pdf|summarize this pdf)\b/i;

export function isSupportedStudyMaterialMime(mimeType: string | null | undefined): boolean {
  return [
    'application/pdf',
    'text/plain',
    'text/markdown',
    'text/x-markdown',
    'application/markdown',
  ].includes(mimeType || '');
}

export function isPotentialAutopsyMime(mimeType: string | null | undefined): boolean {
  return [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/webp',
    'text/plain',
  ].includes(mimeType || '');
}

export function classifyChatUploadIntent(input: {
  message: string;
  mimeType: string | null | undefined;
  filename?: string | null;
}): ChatUploadIntent {
  const text = `${input.message || ''} ${input.filename || ''}`;

  if (AUTOPSY_RE.test(text) && isPotentialAutopsyMime(input.mimeType)) {
    return 'autopsy_mock_analysis';
  }

  if (STUDY_MATERIAL_RE.test(text) && isSupportedStudyMaterialMime(input.mimeType)) {
    return 'study_material_index';
  }

  if (ONE_TURN_READ_RE.test(text) && isSupportedStudyMaterialMime(input.mimeType)) {
    return 'one_turn_document_read';
  }

  if (isSupportedStudyMaterialMime(input.mimeType)) {
    return 'one_turn_document_read';
  }

  return 'unsupported';
}
