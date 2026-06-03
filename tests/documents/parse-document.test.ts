// tests/documents/parse-document.test.ts
// Unit tests for parseGeneratedDocument and documentToText.

import { describe, it, expect } from 'vitest';
import { parseGeneratedDocument, looksLikeGeneratedDocument } from '@/lib/documents/parse-generated-document';
import { documentToText } from '@/lib/documents/document-to-text';
import type { MockTestDocument, GeneratedDocument } from '@/lib/documents/document-types';

// ── Fixtures ─────────────────────────────────────────────────────────────────

const VALID_MOCK_TEST_JSON = JSON.stringify({
  id: 'test_001',
  kind: 'mock_test',
  title: 'NEET Mock Test: Electric Charges',
  exam: 'NEET',
  createdAt: new Date().toISOString(),
  metadata: {
    totalQuestions: 2,
    durationMinutes: 60,
    subjects: ['Physics'],
    difficulty: 'medium',
  },
  questions: [
    {
      id: 'q_1',
      number: 1,
      subject: 'Physics',
      chapter: 'Electric Charges and Fields',
      status: 'correct',
      question: 'What is the SI unit of electric charge?',
      options: { A: 'Ampere', B: 'Coulomb', C: 'Volt', D: 'Ohm' },
      correctAnswer: 'B',
      explanation: 'Coulombs measure charge.',
    },
    {
      id: 'q_2',
      number: 2,
      subject: 'Physics',
      chapter: 'Electric Charges and Fields',
      status: 'incorrect',
      question: 'Which law gives the force between two point charges?',
      options: { A: "Newton's Law", B: "Coulomb's Law", C: "Gauss's Law", D: "Ohm's Law" },
      correctAnswer: 'B',
    },
  ],
});

const PLAIN_MCQ_TEXT = `Q1. What is the SI unit of electric charge?
A) Ampere
B) Coulomb
C) Volt
D) Ohm
Answer: B
Status: correct
Subject: Physics
Chapter: Electric Charges
Explanation: Coulombs are the SI unit.
---
Q2. Which law gives the force between two point charges?
A) Newton's Law
B) Coulomb's Law
C) Gauss's Law
D) Ohm's Law
Answer: B
Status: incorrect
Subject: Physics`;

// ── Tests: parseGeneratedDocument ─────────────────────────────────────────────

describe('parseGeneratedDocument', () => {
  it('parses valid JSON into a MockTestDocument', () => {
    const doc = parseGeneratedDocument(VALID_MOCK_TEST_JSON);
    expect(doc.kind).toBe('mock_test');

    const mockDoc = doc as MockTestDocument;
    expect(mockDoc.title).toBe('NEET Mock Test: Electric Charges');
    expect(mockDoc.exam).toBe('NEET');
    expect(mockDoc.questions).toHaveLength(2);
    expect(mockDoc.questions[0].correctAnswer).toBe('B');
    expect(mockDoc.questions[0].status).toBe('correct');
    expect(mockDoc.questions[1].status).toBe('incorrect');
    expect(mockDoc.questions[0].subject).toBe('Physics');
    expect(mockDoc.questions[0].chapter).toBe('Electric Charges and Fields');
  });

  it('parses JSON wrapped in markdown code fences', () => {
    const wrapped = '```json\n' + VALID_MOCK_TEST_JSON + '\n```';
    const doc = parseGeneratedDocument(wrapped);
    expect(doc.kind).toBe('mock_test');
  });

  it('parses plain MCQ text format into a MockTestDocument', () => {
    const doc = parseGeneratedDocument(PLAIN_MCQ_TEXT);
    expect(doc.kind).toBe('mock_test');

    const mockDoc = doc as MockTestDocument;
    expect(mockDoc.questions).toHaveLength(2);
    expect(mockDoc.questions[0].number).toBe(1);
    expect(mockDoc.questions[0].correctAnswer).toBe('B');
    expect(mockDoc.questions[0].status).toBe('correct');
    expect(mockDoc.questions[0].subject).toBe('Physics');
    expect(mockDoc.questions[0].chapter).toBe('Electric Charges');
    expect(mockDoc.questions[1].status).toBe('incorrect');
  });

  it('falls back to learning_notes on unparseable input', () => {
    const doc = parseGeneratedDocument('This is just a random conversation message.');
    expect(doc.kind).toBe('learning_notes');
  });

  it('falls back to learning_notes on empty input', () => {
    const doc = parseGeneratedDocument('');
    expect(doc.kind).toBe('learning_notes');
  });

  it('never throws on malformed JSON', () => {
    expect(() => parseGeneratedDocument('{ "kind": "mock_test", invalid')).not.toThrow();
    const doc = parseGeneratedDocument('{ "kind": "mock_test", invalid');
    expect(doc).toBeDefined();
    expect(doc.kind).toBeDefined();
  });
});

// ── Tests: looksLikeGeneratedDocument ────────────────────────────────────────

describe('looksLikeGeneratedDocument', () => {
  it('returns true for JSON with "kind" field', () => {
    expect(looksLikeGeneratedDocument(VALID_MOCK_TEST_JSON)).toBe(true);
  });

  it('returns true for plain MCQ format', () => {
    expect(looksLikeGeneratedDocument(PLAIN_MCQ_TEXT)).toBe(true);
  });

  it('returns false for regular chat text', () => {
    expect(looksLikeGeneratedDocument('Sure! Here is what you need to know about Newton\'s laws.')).toBe(false);
  });
});

// ── Tests: documentToText ─────────────────────────────────────────────────────

describe('documentToText', () => {
  it('produces clean extractable text from a MockTestDocument', () => {
    const doc = parseGeneratedDocument(VALID_MOCK_TEST_JSON) as MockTestDocument;
    const text = documentToText(doc);

    // Should contain question numbers
    expect(text).toContain('Q1.');
    expect(text).toContain('Q2.');
    // Should contain options
    expect(text).toContain('A. Ampere');
    expect(text).toContain('B. Coulomb');
    // Should contain correct answer label
    expect(text).toContain('Correct Answer: B');
    // Should contain status badge text
    expect(text).toContain('[Correct]');
    expect(text).toContain('[Incorrect]');
    // Should contain answer key
    expect(text).toContain('ANSWER KEY');
  });

  it('includes subject and chapter metadata in text output', () => {
    const doc = parseGeneratedDocument(VALID_MOCK_TEST_JSON) as MockTestDocument;
    const text = documentToText(doc);
    expect(text).toContain('Physics');
    expect(text).toContain('Electric Charges');
  });

  it('handles learning_notes documents', () => {
    const doc: GeneratedDocument = {
      id: 'ln_1',
      kind: 'learning_notes',
      title: 'Newton\'s Laws',
      createdAt: new Date().toISOString(),
      sections: [
        { heading: 'First Law', content: 'An object at rest stays at rest.' },
      ],
    };
    const text = documentToText(doc);
    expect(text).toContain('Newton\'s Laws');
    expect(text).toContain('First Law');
    expect(text).toContain('An object at rest');
  });
});
