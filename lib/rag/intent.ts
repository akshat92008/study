export type RagMode = 'explicit' | 'implicit' | 'off';

const EXPLICIT_SOURCE_RE = /\b(from|according to|based on|use|using|cite|citation|source[- ]grounded|grounded in)\b.*\b(ncert|pdf|uploaded|upload|notes?|material|source|chapter|book)\b|\b(ncert|my notes?|uploaded material|the pdf|this pdf|source material)\b/i;
const STUDY_RE = /\b(explain|summari[sz]e|make|generate|flashcards?|mcqs?|questions?|notes?|study guide|compare|according|chapter|topic|formula|neet|ncert)\b/i;

export function classifyRagMode(message: string): RagMode {
  const text = message || '';
  if (EXPLICIT_SOURCE_RE.test(text)) return 'explicit';
  if (STUDY_RE.test(text) && text.length > 12) return 'implicit';
  return 'off';
}

export function mentionsNcert(message: string): boolean {
  return /\bncert\b/i.test(message || '');
}
