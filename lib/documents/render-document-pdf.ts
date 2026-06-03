// lib/documents/render-document-pdf.ts
// Generates a real-text, OCR-friendly PDF from a GeneratedDocument.
// Uses jspdf (already in package.json) with direct text calls — NOT html2canvas.
// This produces selectable, copy-pasteable, OCR-extractable text in the PDF.
//
// Compatible with Vercel Edge/Node runtime when called from a server route.

import { jsPDF } from 'jspdf';
import type { GeneratedDocument, MockTestDocument } from './document-types';
import { documentToText } from './document-to-text';

// ── Layout constants ──────────────────────────────────────────────────────────

const PAGE_WIDTH = 210;    // A4 mm
const PAGE_HEIGHT = 297;   // A4 mm
const MARGIN = 18;         // mm
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 6;     // mm per line
const SMALL_LINE = 5;      // mm compact

// ── Helpers ───────────────────────────────────────────────────────────────────

type PDFState = {
  doc: jsPDF;
  y: number;
};

function checkPageBreak(state: PDFState, neededMm = LINE_HEIGHT): PDFState {
  if (state.y + neededMm > PAGE_HEIGHT - MARGIN) {
    state.doc.addPage();
    state.y = MARGIN + 4;
  }
  return state;
}

function addText(
  state: PDFState,
  text: string,
  opts: {
    fontSize?: number;
    bold?: boolean;
    color?: [number, number, number];
    indent?: number;
    lineGap?: number;
  } = {}
): PDFState {
  const {
    fontSize = 10,
    bold = false,
    color = [30, 30, 30],
    indent = 0,
    lineGap = LINE_HEIGHT,
  } = opts;

  state.doc.setFontSize(fontSize);
  state.doc.setFont('helvetica', bold ? 'bold' : 'normal');
  state.doc.setTextColor(color[0], color[1], color[2]);

  const maxWidth = CONTENT_WIDTH - indent;
  const lines = state.doc.splitTextToSize(text, maxWidth);

  for (const line of lines) {
    state = checkPageBreak(state, lineGap);
    state.doc.text(line, MARGIN + indent, state.y);
    state.y += lineGap;
  }

  return state;
}

function addHRule(state: PDFState, color: [number, number, number] = [200, 200, 200]): PDFState {
  state = checkPageBreak(state, 4);
  state.doc.setDrawColor(color[0], color[1], color[2]);
  state.doc.setLineWidth(0.3);
  state.doc.line(MARGIN, state.y, PAGE_WIDTH - MARGIN, state.y);
  state.y += 3;
  return state;
}

function statusBadgeText(status: string | undefined): string {
  if (!status) return '';
  if (status === 'correct') return '[✓ Correct] ';
  if (status === 'incorrect') return '[✗ Incorrect] ';
  if (status === 'unattempted') return '[— Unattempted] ';
  return '';
}

// ── Mock Test PDF ─────────────────────────────────────────────────────────────

function renderMockTestPDF(doc: MockTestDocument): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let state: PDFState = { doc: pdf, y: MARGIN + 6 };

  // ── Title Block ──────────────────────────────────────────────────────────────
  state = addText(state, doc.title, { fontSize: 16, bold: true, color: [20, 20, 60] });
  state.y += 1;

  // Metadata row
  const metaParts = [
    `Exam: ${doc.exam}`,
    `Questions: ${doc.metadata.totalQuestions}`,
    doc.metadata.durationMinutes ? `Duration: ${doc.metadata.durationMinutes} min` : null,
    doc.metadata.difficulty ? `Difficulty: ${doc.metadata.difficulty}` : null,
  ].filter(Boolean).join('   |   ');

  state = addText(state, metaParts, { fontSize: 9, color: [80, 80, 120] });

  if (doc.metadata.subjects.length > 0) {
    state = addText(state, `Subjects: ${doc.metadata.subjects.join(', ')}`, {
      fontSize: 9,
      color: [80, 80, 120],
    });
  }

  state = addText(state, `Generated: ${new Date(doc.createdAt).toLocaleDateString('en-IN')}`, {
    fontSize: 8,
    color: [140, 140, 140],
  });
  state.y += 2;
  state = addHRule(state, [100, 100, 180]);
  state.y += 2;

  // ── Questions ─────────────────────────────────────────────────────────────────
  for (const q of doc.questions) {
    state = checkPageBreak(state, 40);

    // Question heading: Q1. [Correct] Physics · Electric Charges
    const subjectChapter = [q.subject, q.chapter].filter(Boolean).join(' · ');
    const badge = statusBadgeText(q.status);
    const qHeader = `Q${q.number}. ${badge}${subjectChapter}`;

    state = addText(state, qHeader, {
      fontSize: 10,
      bold: true,
      color: q.status === 'correct'
        ? [0, 120, 60]
        : q.status === 'incorrect'
          ? [180, 30, 30]
          : [40, 40, 100],
    });

    // Question text
    state = addText(state, q.question, {
      fontSize: 10,
      indent: 4,
      lineGap: SMALL_LINE,
    });
    state.y += 2;

    // Options
    const optLabels = ['A', 'B', 'C', 'D'] as const;
    for (const label of optLabels) {
      const optText = q.options[label];
      if (!optText) continue;
      const isCorrect = q.correctAnswer === label;
      state = addText(state, `  ${label}.  ${optText}`, {
        fontSize: 9.5,
        indent: 6,
        lineGap: SMALL_LINE,
        color: isCorrect ? [0, 120, 60] : [50, 50, 50],
        bold: isCorrect,
      });
    }
    state.y += 2;

    // Correct answer line
    state = addText(state, `Correct Answer: ${q.correctAnswer}`, {
      fontSize: 9,
      indent: 4,
      bold: true,
      color: [0, 120, 60],
    });

    // Explanation
    if (q.explanation) {
      state = addText(state, `Explanation: ${q.explanation}`, {
        fontSize: 8.5,
        indent: 4,
        color: [90, 90, 90],
        lineGap: SMALL_LINE,
      });
    }

    state.y += 3;
    state = addHRule(state, [220, 220, 230]);
    state.y += 2;
  }

  // ── Answer Key Table ──────────────────────────────────────────────────────────
  pdf.addPage();
  state = { doc: pdf, y: MARGIN + 6 };

  state = addText(state, 'ANSWER KEY', { fontSize: 13, bold: true, color: [20, 20, 60] });
  state.y += 2;
  state = addHRule(state, [100, 100, 180]);
  state.y += 2;

  // Table header
  const col = { no: MARGIN, subj: MARGIN + 14, chap: MARGIN + 48, ans: MARGIN + 100, st: MARGIN + 116 };

  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(60, 60, 60);
  pdf.text('Q No', col.no, state.y);
  pdf.text('Subject', col.subj, state.y);
  pdf.text('Chapter', col.chap, state.y);
  pdf.text('Answer', col.ans, state.y);
  pdf.text('Status', col.st, state.y);
  state.y += SMALL_LINE;
  state = addHRule(state, [180, 180, 200]);

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8.5);

  for (const q of doc.questions) {
    state = checkPageBreak(state, SMALL_LINE + 1);

    const statusColor: [number, number, number] =
      q.status === 'correct' ? [0, 140, 60]
        : q.status === 'incorrect' ? [180, 30, 30]
          : [120, 120, 120];

    pdf.setTextColor(50, 50, 50);
    pdf.text(String(q.number), col.no, state.y);
    pdf.text((q.subject || '—').slice(0, 14), col.subj, state.y);
    pdf.text((q.chapter || '—').slice(0, 22), col.chap, state.y);
    pdf.text(q.correctAnswer, col.ans, state.y);

    pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
    pdf.text(q.status || 'unattempted', col.st, state.y);

    state.y += SMALL_LINE;
  }

  return pdf;
}

// ── Plain Text / Notes PDF ────────────────────────────────────────────────────

function renderPlainTextPDF(doc: GeneratedDocument): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  let state: PDFState = { doc: pdf, y: MARGIN + 6 };

  const title = 'title' in doc ? doc.title : 'Generated Document';
  state = addText(state, title, { fontSize: 15, bold: true, color: [20, 20, 60] });
  state.y += 2;
  state = addHRule(state, [100, 100, 180]);
  state.y += 2;

  const text = documentToText(doc);
  const lines = text.split('\n');

  for (const line of lines) {
    const trimmed = line.trimEnd();
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      state.y += 2;
      state = addText(state, trimmed.replace(/^#+\s*/, ''), {
        fontSize: 11,
        bold: true,
        color: [40, 40, 100],
      });
      state.y += 1;
    } else if (trimmed === '' || trimmed === '─'.repeat(60)) {
      state.y += 2;
    } else {
      state = addText(state, trimmed, { fontSize: 9.5, lineGap: SMALL_LINE });
    }
  }

  return pdf;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Renders a GeneratedDocument as an OCR-friendly PDF buffer.
 * Uses real jsPDF text calls — NOT screenshots or html2canvas.
 * The resulting PDF contains selectable, extractable text.
 */
export function renderDocumentPDF(doc: GeneratedDocument): Buffer {
  let pdf: jsPDF;

  if (doc.kind === 'mock_test') {
    pdf = renderMockTestPDF(doc);
  } else {
    pdf = renderPlainTextPDF(doc);
  }

  // jsPDF output('arraybuffer') returns ArrayBuffer
  const arrayBuffer = pdf.output('arraybuffer');
  return Buffer.from(arrayBuffer);
}

/**
 * Returns a safe filename for the PDF download.
 */
export function getPDFFilename(doc: GeneratedDocument): string {
  const title = 'title' in doc ? doc.title : 'document';
  const safe = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `${safe || 'document'}.pdf`;
}
