import { evaluateAnswer, type AnswerScore } from './evaluate-answer';
import { findQuestionByText } from './question-engine';

export type AnswerEvaluation = {
  status: AnswerScore;
  feedback: string;
  identifiedGaps: string[];
};

export async function evaluateTutorAnswer(
  systemPromptContext: string,
  question: string,
  userAnswer: string
): Promise<AnswerEvaluation> {
  const deterministic = findQuestionByText(question);
  if (!deterministic) {
    return {
      status: 'partial',
      feedback: `I could not match that question to the active ${systemPromptContext} question bank, so I will repair it with a specific follow-up.`,
      identifiedGaps: [],
    };
  }

  const result = evaluateAnswer({
    question: deterministic.question,
    expectedAnswerPoints: deterministic.expectedAnswerPoints,
    userAnswer,
    conceptTags: deterministic.conceptTags,
    chapterSlug: 'neet-biology-biotechnology',
  });

  return {
    status: result.score,
    feedback: result.feedback,
    identifiedGaps: result.missingPoints,
  };
}
