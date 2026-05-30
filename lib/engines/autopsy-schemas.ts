import { z } from 'zod';

export const MistakeCategorySchema = z.enum([
  'conceptual', 'calculation', 'silly', 'time_pressure', 'misread', 
  'incomplete_knowledge', 'overconfidence', 'anxiety', 'recall_failure'
]);

export const AutopsyQuestionSchema = z.object({
  questionNumber: z.number().int().positive(),
  subject: z.string(),
  chapter: z.string().default('Unknown'),
  subtopic: z.string().nullable().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).default('Medium'),
  questionText: z.string().nullable().optional(),
  correctAnswer: z.string().nullable().optional(),
  studentAnswer: z.string().nullable().optional(),
  status: z.enum(['Correct', 'Incorrect', 'Unattempted', 'NeedsReview']),
  mistakeCategory: MistakeCategorySchema.nullable(),
  reasoning: z.string().nullable().optional(), // Explainability for the student
  ocrConfidence: z.number().min(0).max(100), // Confidence in the scan/OMR read
});

export const AutopsyPaperSchema = z.object({
  questions: z.array(AutopsyQuestionSchema),
  overallPaperQuality: z.string().optional(), // For detecting unreadable scans
});

export const RecoveryTaskSchema = z.object({
  day: z.number().int().positive(),
  subject: z.string(),
  action: z.string(),
  marksGain: z.number().int().nonnegative(),
});

export const RecoveryPlanSchema = z.object({
  mentorQuote: z.string(),
  tasks: z.array(RecoveryTaskSchema).max(7), // 7-day sprint plan
});
