import { z } from 'zod';
import {
  AmauraAgentResultSchema,
  emptyAmauraResult,
  skippedAmauraResult,
  type AmauraAgentDefinition,
} from '../types';
import { eventDedupKey } from '../idempotency';
import { createAdminClient } from '@/lib/supabase/admin';
import { budgetedGenerateJSON } from '@/lib/ai/budgeted';
import { logger } from '@/lib/utils/logger';

const PracticeRequestedSchema = z.object({
  subject: z.string().nullable().optional(),
  topic: z.string().nullable().optional(),
  chapter: z.string().nullable().optional(),
  count: z.number().int().min(1).max(20).default(5),
  goalId: z.string().nullable().optional(),
  goal_id: z.string().nullable().optional(),
}).passthrough();

const GeneratedQuestionSchema = z.object({
  question: z.string(),
  options: z.array(z.string()).min(2),
  correct_answer: z.string(),
  explanation: z.string(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  concept_name: z.string().optional(),
});

const GeneratedSetSchema = z.object({
  questions: z.array(GeneratedQuestionSchema),
  title: z.string(),
});

export const PracticeGeneratorAgent: AmauraAgentDefinition<z.infer<typeof PracticeRequestedSchema>> = {
  name: 'PracticeGeneratorAgent',
  handledEvents: ['PRACTICE_REQUESTED'],
  stateVisibleEffects: ['task', 'notification'],
  inputSchema: PracticeRequestedSchema,
  outputSchema: AmauraAgentResultSchema,
  getDedupKey: (context, payload) => eventDedupKey('PracticeGeneratorAgent', context, payload),
  budget: { maxAiCalls: 1, model: 'gemini-flash', requireBudget: true },
  idempotency: { scope: 'event' },
  notification: { priority: 'normal', maxPerWindow: 1, windowHours: 1 },
  retry: { maxRetries: 1, retryable: true },
  async run(context, payload) {
    const { subject, topic, chapter, count = 5 } = payload;
    const goalId = context.goalId ?? payload.goalId ?? payload.goal_id ?? null;
    
    if (!subject || (!topic && !chapter)) {
      return skippedAmauraResult('Insufficient context to generate practice (missing subject or topic).');
    }

    const targetTopic = topic || chapter;

    const prompt = `
      You are an expert ${subject} educator. 
      Generate exactly ${count} multiple-choice questions (MCQs) for the topic: "${targetTopic}".
      
      RULES:
      - Each question must have 4 options.
      - Specify the correct_answer (one of the options).
      - Provide a clear explanation for the correct answer.
      - Assign a difficulty level (easy, medium, hard).
      - Provide a descriptive title for this practice set.
      
      Respond ONLY with JSON.
    `;

    const result = await budgetedGenerateJSON<z.infer<typeof GeneratedSetSchema>>({
      userId: context.userId,
      feature: 'tutor',
      route: 'practice:generation',
      model: 'fast',
      systemPrompt: 'You are a practice question generator. Return JSON only.',
      userPrompt: prompt,
      schema: GeneratedSetSchema,
    });

    if (!result || !result.questions || result.questions.length === 0) {
      throw new Error('AI failed to generate practice questions.');
    }

    const supabase = createAdminClient();

    // 1. Create Practice Set
    const { data: practiceSet, error: setError } = await supabase
      .from('practice_sets')
      .insert({
        user_id: context.userId,
        goal_id: goalId,
        topic: targetTopic,
        subject,
        set_type: 'mcq',
        source: 'amaura_practice_generator',
      })
      .select()
      .single();

    if (setError || !practiceSet) {
      throw new Error(`Failed to create practice set: ${setError?.message}`);
    }

    // 2. Create Practice Items
    const practiceItems = result.questions.map((q, idx) => ({
      practice_set_id: practiceSet.id,
      user_id: context.userId,
      question: q.question,
      options: q.options,
      correct_answer: q.correct_answer,
      explanation: q.explanation,
      difficulty: q.difficulty,
      concept_name: q.concept_name || targetTopic,
      position: idx + 1,
    }));

    const { error: itemsError } = await supabase
      .from('practice_items')
      .insert(practiceItems);

    if (itemsError) {
      throw new Error(`Failed to create practice items: ${itemsError.message}`);
    }

    // 3. Create Notification
    await supabase.from('amaura_notifications').insert({
      user_id: context.userId,
      goal_id: goalId,
      type: 'practice_ready',
      priority: 'normal',
      title: 'Practice set ready',
      message: `I've generated ${result.questions.length} questions on ${targetTopic}. You can start practicing now.`,
      action_label: 'Start Practice',
      action_type: 'open_practice',
      action_payload: { practiceSetId: practiceSet.id },
      metadata: { eventId: context.eventId, practiceSetId: practiceSet.id },
    });

    return emptyAmauraResult({
      actionsTaken: 1 + result.questions.length,
      notificationsCreated: 1,
      aiCallsUsed: context.budget.aiCallsUsed,
    });
  },
};
