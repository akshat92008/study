// lib/documents/document-to-text.ts
// Converts a GeneratedDocument into clean plain text.
// Used by the copy button, fallback display, and AI context reuse.

import type {
  GeneratedDocument,
  MockTestDocument,
  FormulaSheetDocument,
  MCQFlashcardsDocument,
  LearningNotesDocument,
} from './document-types';

function statusLabel(status: string | undefined): string {
  if (!status) return '';
  if (status === 'correct') return '[Correct] ';
  if (status === 'incorrect') return '[Incorrect] ';
  if (status === 'unattempted') return '[Unattempted] ';
  return '';
}

function mockTestToText(doc: MockTestDocument): string {
  const lines: string[] = [];

  lines.push(`${doc.title}`);
  lines.push(`Exam: ${doc.exam} | Questions: ${doc.metadata.totalQuestions}${doc.metadata.durationMinutes ? ` | Duration: ${doc.metadata.durationMinutes} min` : ''}`);
  if (doc.metadata.subjects.length > 0) {
    lines.push(`Subjects: ${doc.metadata.subjects.join(', ')}`);
  }
  lines.push('');
  lines.push('─'.repeat(60));
  lines.push('');

  for (const q of doc.questions) {
    const subjectChapter = [q.subject, q.chapter].filter(Boolean).join(' · ');
    lines.push(`Q${q.number}. ${statusLabel(q.status)}${subjectChapter ? `(${subjectChapter}) ` : ''}${q.question}`);
    lines.push('');
    lines.push(`  A. ${q.options.A}`);
    lines.push(`  B. ${q.options.B}`);
    lines.push(`  C. ${q.options.C}`);
    lines.push(`  D. ${q.options.D}`);
    lines.push('');
    lines.push(`  Correct Answer: ${q.correctAnswer}`);
    if (q.explanation) {
      lines.push(`  Explanation: ${q.explanation}`);
    }
    lines.push('');
  }

  // Answer key table
  lines.push('─'.repeat(60));
  lines.push('ANSWER KEY');
  lines.push('─'.repeat(60));
  lines.push('Q No | Subject       | Chapter           | Answer | Status');
  lines.push('─'.repeat(60));
  for (const q of doc.questions) {
    const qNo = String(q.number).padEnd(5);
    const subj = (q.subject || 'General').padEnd(14);
    const chap = (q.chapter || '—').slice(0, 18).padEnd(18);
    const ans = q.correctAnswer.padEnd(7);
    const st = q.status || 'unattempted';
    lines.push(`${qNo}| ${subj}| ${chap}| ${ans}| ${st}`);
  }

  return lines.join('\n');
}

function formulaSheetToText(doc: FormulaSheetDocument): string {
  const lines: string[] = [];
  lines.push(doc.title);
  if (doc.subject) lines.push(`Subject: ${doc.subject}`);
  lines.push('');

  for (const item of doc.items) {
    lines.push(`${item.name}: ${item.formula}`);
    if (item.meaning) lines.push(`  Meaning: ${item.meaning}`);
    if (item.units) lines.push(`  Units: ${item.units}`);
    if (item.useWhen) lines.push(`  Use when: ${item.useWhen}`);
    lines.push('');
  }

  if (doc.rawContent) {
    lines.push(doc.rawContent);
  }

  return lines.join('\n');
}

function flashcardsToText(doc: MCQFlashcardsDocument): string {
  const lines: string[] = [];
  lines.push(doc.title);
  if (doc.subject) lines.push(`Subject: ${doc.subject}`);
  lines.push('');

  for (const card of doc.cards) {
    lines.push(`Card ${card.number}`);
    lines.push(`Q: ${card.front}`);
    lines.push(`A: ${card.back}`);
    lines.push('');
  }

  return lines.join('\n');
}

function learningNotesToText(doc: LearningNotesDocument): string {
  if (doc.rawContent) return doc.rawContent;
  const lines: string[] = [];
  lines.push(doc.title);
  if (doc.subject) lines.push(`Subject: ${doc.subject}`);
  if (doc.chapter) lines.push(`Chapter: ${doc.chapter}`);
  lines.push('');

  for (const section of doc.sections) {
    lines.push(`## ${section.heading}`);
    lines.push(section.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Converts a GeneratedDocument to clean plain text suitable for:
 * - copy button
 * - fallback display
 * - AI context reuse
 */
export function documentToText(doc: GeneratedDocument): string {
  switch (doc.kind) {
    case 'mock_test':
      return mockTestToText(doc);
    case 'formula_sheet':
      return formulaSheetToText(doc);
    case 'mcq_flashcards':
      return flashcardsToText(doc);
    case 'learning_notes':
      return learningNotesToText(doc);
  }
}
