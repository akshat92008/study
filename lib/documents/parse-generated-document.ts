// lib/documents/parse-generated-document.ts
// Normalizes raw AI output (JSON or plain MCQ text) into the GeneratedDocument schema.
// Never throws — always returns a valid GeneratedDocument on failure.

import type {
  GeneratedDocument,
  MockTestDocument,
  MCQQuestion,
  LearningNotesDocument,
  AnswerKey,
  QuestionStatus,
  Subject,
} from './document-types';

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeSubject(raw: string | undefined): Subject {
  if (!raw) return 'General';
  const s = raw.trim();
  if (/physics/i.test(s)) return 'Physics';
  if (/chem/i.test(s)) return 'Chemistry';
  if (/bio/i.test(s)) return 'Biology';
  return 'General';
}

function normalizeAnswer(raw: string | undefined): AnswerKey {
  if (!raw) return 'A';
  const letter = raw.trim().toUpperCase().replace(/[^ABCD]/, '');
  if (letter === 'A' || letter === 'B' || letter === 'C' || letter === 'D') return letter;
  return 'A';
}

function normalizeStatus(raw: string | undefined): QuestionStatus | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase().trim();
  if (s === 'correct') return 'correct';
  if (s === 'incorrect') return 'incorrect';
  if (s === 'unattempted') return 'unattempted';
  return undefined;
}

// ── JSON Parser ───────────────────────────────────────────────────────────────

function tryParseJSON(raw: string): GeneratedDocument | null {
  // Strip markdown code fences
  const clean = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(clean);
  } catch {
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null) return null;

  const obj = parsed as Record<string, unknown>;

  // Validate it looks like a mock_test document
  if (obj['kind'] === 'mock_test' && Array.isArray(obj['questions'])) {
    const rawQuestions = obj['questions'] as Array<Record<string, unknown>>;
    const questions: MCQQuestion[] = rawQuestions.map((q, i) => {
      const opts = (q['options'] as Record<string, string>) || {};
      return {
        id: typeof q['id'] === 'string' ? q['id'] : `q_${i + 1}`,
        number: typeof q['number'] === 'number' ? q['number'] : i + 1,
        subject: normalizeSubject(q['subject'] as string),
        chapter: typeof q['chapter'] === 'string' ? q['chapter'] : undefined,
        status: normalizeStatus(q['status'] as string),
        question: typeof q['question'] === 'string' ? q['question'] : '',
        options: {
          A: typeof opts['A'] === 'string' ? opts['A'] : '',
          B: typeof opts['B'] === 'string' ? opts['B'] : '',
          C: typeof opts['C'] === 'string' ? opts['C'] : '',
          D: typeof opts['D'] === 'string' ? opts['D'] : '',
        },
        correctAnswer: normalizeAnswer(q['correctAnswer'] as string),
        explanation: typeof q['explanation'] === 'string' ? q['explanation'] : undefined,
      };
    });

    const metadata = (obj['metadata'] as Record<string, unknown>) || {};
    const doc: MockTestDocument = {
      id: typeof obj['id'] === 'string' ? obj['id'] : generateId(),
      kind: 'mock_test',
      title: typeof obj['title'] === 'string' ? obj['title'] : 'Mock Test',
      exam: typeof obj['exam'] === 'string' ? obj['exam'] : 'NEET',
      createdAt: typeof obj['createdAt'] === 'string' ? obj['createdAt'] : new Date().toISOString(),
      metadata: {
        totalQuestions: questions.length,
        durationMinutes: typeof metadata['durationMinutes'] === 'number' ? metadata['durationMinutes'] : undefined,
        subjects: Array.isArray(metadata['subjects'])
          ? (metadata['subjects'] as string[])
          : [...new Set(questions.map(q => q.subject))],
        difficulty: (['easy', 'medium', 'hard', 'mixed'] as const).includes(metadata['difficulty'] as any)
          ? (metadata['difficulty'] as 'easy' | 'medium' | 'hard' | 'mixed')
          : 'mixed',
      },
      questions,
    };

    return doc;
  }

  return null;
}

// ── Plain Text MCQ Parser ─────────────────────────────────────────────────────
// Handles formats like:
//   Q1. What is...
//   A) Option A
//   B) Option B
//   C) Option C
//   D) Option D
//   Answer: B
//   Status: correct
//   Subject: Physics
//   Chapter: Electric Charges
//   Explanation: Because...
//   ---

function parsePlainMCQText(text: string): MockTestDocument | null {
  // Split into question blocks on --- or double newline before a Q\d+ pattern
  const blocks = text.split(/\n\s*---\s*\n|\n(?=Q\d+[\.\)])/g).filter(b => b.trim());

  if (blocks.length === 0) return null;

  const questions: MCQQuestion[] = [];

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    let questionText = '';
    const options: { A: string; B: string; C: string; D: string } = { A: '', B: '', C: '', D: '' };
    let answer: AnswerKey = 'A';
    let status: QuestionStatus | undefined;
    let subject: Subject = 'General';
    let chapter: string | undefined;
    let explanation: string | undefined;
    let qNumber = questions.length + 1;

    for (const line of lines) {
      const l = line.trim();

      // Question line: Q1. text  or  Q1) text
      const qMatch = l.match(/^Q(\d+)[\.\)]\s*(.*)/i);
      if (qMatch) {
        qNumber = parseInt(qMatch[1], 10);
        questionText = qMatch[2];
        continue;
      }

      // Options: A) / A. / (A) / A:
      const optMatch = l.match(/^(?:\()?([ABCD])(?:\)|\.|:)\s*(.*)/i);
      if (optMatch) {
        const letter = optMatch[1].toUpperCase() as AnswerKey;
        if (letter === 'A' || letter === 'B' || letter === 'C' || letter === 'D') {
          options[letter] = optMatch[2].trim();
        }
        continue;
      }

      // Answer line
      const answerMatch = l.match(/^(?:Answer|Ans|Correct Answer)[:\s]+([ABCD])/i);
      if (answerMatch) {
        answer = normalizeAnswer(answerMatch[1]);
        continue;
      }

      // Status line
      const statusMatch = l.match(/^Status[:\s]+(correct|incorrect|unattempted)/i);
      if (statusMatch) {
        status = normalizeStatus(statusMatch[1]);
        continue;
      }

      // Subject line
      const subjectMatch = l.match(/^Subject[:\s]+(.*)/i);
      if (subjectMatch) {
        subject = normalizeSubject(subjectMatch[1]);
        continue;
      }

      // Chapter line
      const chapterMatch = l.match(/^Chapter[:\s]+(.*)/i);
      if (chapterMatch) {
        chapter = chapterMatch[1].trim();
        continue;
      }

      // Explanation line
      const expMatch = l.match(/^Explanation[:\s]+(.*)/i);
      if (expMatch) {
        explanation = expMatch[1].trim();
        continue;
      }
    }

    if (questionText && (options.A || options.B)) {
      questions.push({
        id: `q_${qNumber}`,
        number: qNumber,
        subject,
        chapter,
        status,
        question: questionText,
        options,
        correctAnswer: answer,
        explanation,
      });
    }
  }

  if (questions.length === 0) return null;

  const subjects = [...new Set(questions.map(q => q.subject))];
  return {
    id: generateId(),
    kind: 'mock_test',
    title: 'NEET Mock Test',
    exam: 'NEET',
    createdAt: new Date().toISOString(),
    metadata: {
      totalQuestions: questions.length,
      subjects,
      difficulty: 'mixed',
    },
    questions,
  };
}

// ── Fallback Document ─────────────────────────────────────────────────────────

function buildFallbackDocument(raw: string): LearningNotesDocument {
  return {
    id: generateId(),
    kind: 'learning_notes',
    title: 'Generated Document',
    createdAt: new Date().toISOString(),
    sections: [{ heading: 'Content', content: raw }],
    rawContent: raw,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parses raw AI output into a GeneratedDocument.
 * Priority: valid JSON → plain MCQ text → fallback learning_notes.
 * Never throws.
 */
export function parseGeneratedDocument(raw: string): GeneratedDocument {
  if (!raw || !raw.trim()) return buildFallbackDocument(raw);

  // 1. Try JSON
  try {
    const jsonDoc = tryParseJSON(raw);
    if (jsonDoc) return jsonDoc;
  } catch {
    // continue
  }

  // 2. Try plain MCQ text
  try {
    const mcqDoc = parsePlainMCQText(raw);
    if (mcqDoc) return mcqDoc;
  } catch {
    // continue
  }

  // 3. Fallback
  return buildFallbackDocument(raw);
}

/**
 * Returns true if the content looks like a structured document
 * (JSON mock_test or plain Q1./Answer: pattern).
 */
export function looksLikeGeneratedDocument(raw: string): boolean {
  if (!raw) return false;
  // JSON check
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  if (trimmed.startsWith('{') && trimmed.includes('"kind"')) return true;
  // Plain MCQ check
  if (/^Q\d+[\.\)]/m.test(raw) && /^(?:Answer|Ans)[:\s]+[ABCD]/im.test(raw)) return true;
  return false;
}
