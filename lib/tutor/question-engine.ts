import { ALL_NEET_CHAPTER_SEEDS } from '../topic-seeding/templates/neet';
import type { QuestionSeed } from '../topic-seeding/types';

export type TutorDifficulty = 'easy' | 'medium' | 'hard';

export type DeterministicTutorQuestion = {
  questionId: string;
  question: string;
  expectedAnswerPoints: string[];
  conceptTags: string[];
  difficulty: TutorDifficulty;
  source: 'deterministic_template';
};

export type NextQuestionInput = {
  chapterSlug?: string | null;
  currentMicrotargetId?: string | null;
  weakAreas?: Array<string | { conceptTag?: string; concept_tag?: string; severity?: string }>;
  recentQuestions?: string[];
  difficulty?: TutorDifficulty;
  mode?: string | null;
};

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function weakTags(input: NextQuestionInput['weakAreas']): string[] {
  return (input ?? []).flatMap((item) => {
    if (typeof item === 'string') return [normalize(item).replace(/\s+/g, '_')];
    const tag = item.conceptTag ?? item.concept_tag;
    return tag ? [normalize(tag).replace(/\s+/g, '_')] : [];
  });
}

export function getAllQuestionsForChapter(chapterSlug: string): DeterministicTutorQuestion[] {
  const normSlug = normalize(chapterSlug);
  // Match exact slug or fallback to biotechnology check for backward compat
  const chapter = ALL_NEET_CHAPTER_SEEDS.find(c => normalize(c.chapterSlug) === normSlug) 
    || (normSlug.includes('biotechnology') ? ALL_NEET_CHAPTER_SEEDS.find(c => c.chapterSlug === 'biotechnology') : null);
    
  if (!chapter) return [];

  const questions: DeterministicTutorQuestion[] = [];
  for (const mission of chapter.missions) {
    for (const mt of mission.microtargets) {
      if (mt.activeRecallQuestions) {
        for (const q of mt.activeRecallQuestions) {
          questions.push({
            questionId: q.id,
            question: q.question,
            expectedAnswerPoints: q.expectedAnswerPoints,
            conceptTags: q.conceptTags,
            difficulty: q.difficulty,
            source: 'deterministic_template',
          });
        }
      }
    }
  }
  return questions;
}

export function getNextQuestion(input: NextQuestionInput): DeterministicTutorQuestion | null {
  const chapter = input.chapterSlug;
  if (!chapter) return null;

  const availableQuestions = getAllQuestionsForChapter(chapter);
  if (availableQuestions.length === 0) return null;

  const recent = new Set((input.recentQuestions ?? []).map(normalize));
  const available = availableQuestions.filter((item) => (
    !recent.has(normalize(item.questionId)) && !recent.has(normalize(item.question))
  ));
  if (available.length === 0) return availableQuestions[0];

  const weak = weakTags(input.weakAreas);
  if (weak.length > 0) {
    const weakMatch = available.find((item) => item.conceptTags.some((tag) => weak.includes(tag)));
    if (weakMatch) return weakMatch;
  }

  if (input.difficulty) {
    const difficultyMatch = available.find((item) => item.difficulty === input.difficulty);
    if (difficultyMatch) return difficultyMatch;
  }

  return available[0];
}

export function findQuestionByText(questionText: string, chapterSlug?: string): DeterministicTutorQuestion | null {
  const normalized = normalize(questionText);
  if (chapterSlug) {
    const questions = getAllQuestionsForChapter(chapterSlug);
    return questions.find((item) => (
      normalized.includes(normalize(item.question)) || normalize(item.question).includes(normalized)
    )) ?? null;
  }
  
  // Very expensive fallback if no chapter provided
  for (const chapter of ALL_NEET_CHAPTER_SEEDS) {
    const match = getAllQuestionsForChapter(chapter.chapterSlug).find((item) => (
      normalized.includes(normalize(item.question)) || normalize(item.question).includes(normalized)
    ));
    if (match) return match;
  }
  return null;
}

export class QuestionEngine {
  static getDeterministicQuestion(topic: string, currentTurn: number) {
    const allQ = getAllQuestionsForChapter(topic);
    const recent = allQ.slice(0, currentTurn).map((item) => item.questionId);
    
    const question = getNextQuestion({
      chapterSlug: topic,
      recentQuestions: recent,
    });
    if (!question) return null;
    return {
      ...question,
      expectedConcepts: question.expectedAnswerPoints,
    };
  }
}

