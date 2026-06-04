import type { SeedTemplate } from '../types';
export const GENERAL_ACADEMIC_TEMPLATES: SeedTemplate[] = [
  {
    templateKey: 'general_mathematics_algebra',
    subject: 'Mathematics',
    chapter: 'Algebra',
    displayName: 'Algebra',
    aliases: ['algebra', 'linear equations', 'quadratic equations', 'polynomials'],
    topics: [
      { orderIndex: 1, topic: 'Variables and expressions', microtarget: 'Understand variables, constants, terms, and algebraic expressions.' },
      { orderIndex: 2, topic: 'Linear equations', microtarget: 'Solve one-variable and two-variable linear equations.' },
      { orderIndex: 3, topic: 'Polynomials', microtarget: 'Add, subtract, multiply, and factor polynomials.' },
      { orderIndex: 4, topic: 'Quadratic equations', microtarget: 'Solve quadratic equations by factorisation, formula, and completing square.' },
      { orderIndex: 5, topic: 'Inequalities', microtarget: 'Solve and graph basic algebraic inequalities.' },
      { orderIndex: 6, topic: 'Functions basics', microtarget: 'Understand input-output, domain, range, and function notation.' },
      { orderIndex: 7, topic: 'Common algebra mistakes', microtarget: 'Avoid sign, factorisation, and equation-solving mistakes.' },
    ],
  },
  {
    templateKey: 'general_learning_pdf_study',
    subject: 'General Learning',
    chapter: 'PDF or Notes Study',
    displayName: 'PDF/Notes Study Workflow',
    aliases: ['study pdf', 'study notes', 'learn from pdf', 'master this document', 'study material'],
    topics: [
      { orderIndex: 1, topic: 'Preview and structure', microtarget: 'Identify the document structure, sections, and main learning outcomes.' },
      { orderIndex: 2, topic: 'Key concepts', microtarget: 'Extract and understand the most important concepts.' },
      { orderIndex: 3, topic: 'Definitions and facts', microtarget: 'Convert important definitions and facts into recall items.' },
      { orderIndex: 4, topic: 'Examples and applications', microtarget: 'Understand examples and apply concepts to questions.' },
      { orderIndex: 5, topic: 'Practice questions', microtarget: 'Attempt practice questions based on the material.' },
      { orderIndex: 6, topic: 'Mistake review', microtarget: 'Review errors and convert them into memory cards.' },
      { orderIndex: 7, topic: 'Final revision', microtarget: 'Revise summary, flashcards, and weak areas.' },
    ],
  },
];
