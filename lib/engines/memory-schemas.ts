import { z } from 'zod';

export const FlashcardSchema = z.object({
  front: z.string().describe("The question, prompt, or cloze deletion. Use LaTeX $...$ for math."),
  back: z.string().describe("The concise answer and explanation."),
});

export const FlashcardBatchSchema = z.object({
  cards: z.array(FlashcardSchema).min(1).max(10),
});
