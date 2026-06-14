import { generateObject } from 'ai';
import { z } from 'zod';
import { getModel } from '@/lib/ai/models';

export type AnswerEvaluation = {
  status: 'correct' | 'partial' | 'incorrect';
  feedback: string;
  identifiedGaps: string[];
};

export async function evaluateTutorAnswer(
  systemPromptContext: string,
  question: string,
  userAnswer: string
): Promise<AnswerEvaluation> {
  const model = getModel('flash');
  
  const prompt = `
You are an expert tutor evaluating a student's answer.
Context: ${systemPromptContext}

Question Asked:
${question}

Student Answer:
${userAnswer}

Evaluate the student's answer accurately.
Return JSON with:
- status: "correct", "partial", or "incorrect"
- feedback: Short explanation of why
- identifiedGaps: Any specific conceptual gaps you noticed in the answer.
`;

  try {
    const { object } = await generateObject({
      model,
      schema: z.object({
        status: z.enum(['correct', 'partial', 'incorrect']),
        feedback: z.string(),
        identifiedGaps: z.array(z.string()),
      }),
      prompt,
      temperature: 0.2,
    });
    
    return object;
  } catch (error) {
    console.error('[EVALUATOR] Failed to evaluate tutor answer:', error);
    // Safe fallback
    return { status: 'partial', feedback: 'I see.', identifiedGaps: [] };
  }
}
