import { z } from 'zod';
import { createEmptyCard } from 'ts-fsrs';
import { budgetedGenerateJSON, budgetedGenerateText } from '@/lib/ai/budgeted';
import { createResolvedLearningGoal } from '@/lib/goals/curriculum-resolver';
import { ensureGoalForUser } from '@/lib/services/goal-context.service';
import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
import { resolveConcept } from '@/lib/engines/concept-resolver';
import { getOrCreateGoalMission, toHermesTasks } from './mission-service';
import { getSourceStatusesForGoal, retrySourceProcessing as retrySourceProcessingService } from '@/lib/services/source-status.service';
import { runHermesMistakeAgent, buildMistakeFallback } from '@/lib/hermes/agents/mistake-agent';
import { buildHermesHeavyMetadata } from './cost-policy';
import { roadmapCard, missionCard, clarificationCard } from './cards';
import type { HermesCard, HermesIntent, HermesUserState } from './types';

type ToolContext = {
  supabase: any;
  userId: string;
  goalId?: string | null;
  intent: HermesIntent;
  state: HermesUserState;
  input: string;
};

const QuizSchema = z.object({
  questions: z.array(z.object({
    question: z.string(),
    options: z.array(z.string()).min(2).max(6),
    correctAnswer: z.string(),
    explanation: z.string().optional(),
  })).min(1).max(10),
});

const FlashcardSchema = z.object({
  cards: z.array(z.object({
    front: z.string(),
    back: z.string(),
  })).min(1).max(12),
});

function safeTopic(input: ToolContext, explicit?: unknown): string {
  if (typeof explicit === 'string' && explicit.trim()) return explicit.trim();
  if (input.intent.entities.topic) return input.intent.entities.topic;
  return input.state.todayTasks[0]?.topic
    ?? input.state.todayTasks[0]?.title
    ?? input.state.activeGoal?.title
    ?? 'current topic';
}

export async function createGoalFromText(ctx: ToolContext, args: Record<string, unknown> = {}): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const title = typeof args.goalTitle === 'string' && args.goalTitle.trim()
    ? args.goalTitle.trim()
    : ctx.intent.entities.goalTitle ?? ctx.input;

  const result = await createResolvedLearningGoal({
    supabase: ctx.supabase,
    userId: ctx.userId,
    title,
    details: {
      subject: ctx.intent.entities.subject,
      domain: typeof args.domain === 'string' ? args.domain : null,
      examType: typeof args.exam === 'string' ? args.exam : null,
    },
  });

  if (!result.success) {
    return {
      cards: [clarificationCard(result.clarificationQuestion, result.suggestions)],
      usedLLM: false,
    };
  }

  const { data: topics } = await ctx.supabase
    .from('seeded_topics')
    .select('id, subject, chapter, topic, microtarget, status, order_index')
    .eq('user_id', ctx.userId)
    .eq('goal_id', result.goalId)
    .order('order_index', { ascending: true })
    .limit(8);

  const roadmap = roadmapCard(result.goal.title, (topics ?? []).map((topic: any) => ({
    id: topic.id,
    title: topic.microtarget ?? topic.topic,
    subject: topic.subject,
    chapter: topic.chapter,
    topic: topic.topic,
    status: topic.status,
    orderIndex: topic.order_index,
  })));

  const mission = missionCard('Today\'s mission', toHermesTasks(result.mission?.tasks ?? []));
  return { cards: [roadmap, mission], usedLLM: false };
}

export async function getOrCreateTodayMission(ctx: ToolContext): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const goalId = ctx.goalId ?? ctx.state.activeGoal?.id;
  if (!goalId) {
    return {
      cards: [clarificationCard('Create a learning goal first?', ['Create a goal for NEET Biology', 'Master Physics Class 12'])],
      usedLLM: false,
    };
  }
  const result = await getOrCreateGoalMission(ctx.supabase, ctx.userId, goalId, new Date().toISOString().split('T')[0]);
  return {
    cards: [missionCard('Today\'s mission', toHermesTasks(result.tasks))],
    usedLLM: false,
  };
}

export async function getSourceStatuses(ctx: ToolContext): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const sources = await getSourceStatusesForGoal({
    supabase: ctx.supabase,
    userId: ctx.userId,
    goalId: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
  });
  return {
    cards: [{ type: 'source_status', sources, actions: [{ id: 'upload-source', label: 'Upload source', type: 'upload_source' }] }],
    usedLLM: false,
  };
}

export async function retrySourceProcessing(ctx: ToolContext, args: Record<string, unknown>): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const sourceId = typeof args.sourceId === 'string' ? args.sourceId : ctx.intent.entities.sourceId;
  if (!sourceId) {
    return { cards: [clarificationCard('Which source should Hermes retry?', [])], usedLLM: false };
  }
  const source = await retrySourceProcessingService({
    supabase: ctx.supabase,
    userId: ctx.userId,
    sourceId,
    goalId: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
  });
  return {
    cards: [{ type: 'source_status', sources: [source], actions: [] }],
    usedLLM: false,
  };
}

export async function getDueReviews(ctx: ToolContext): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const goalId = ctx.goalId ?? ctx.state.activeGoal?.id ?? null;
  if (goalId) await ensureGoalForUser(ctx.supabase, ctx.userId, goalId);
  const now = new Date().toISOString();
  let query = ctx.supabase
    .from('revision_cards')
    .select('id, front, subject, chapter, due')
    .eq('user_id', ctx.userId)
    .lte('due', now)
    .neq('state', 4)
    .order('due', { ascending: true })
    .limit(10);
  if (goalId) query = query.eq('goal_id', goalId);
  const { data, error } = await query;
  if (error) throw new Error('Unable to load due reviews.');
  return {
    cards: [{ type: 'review_queue', dueCount: data?.length ?? ctx.state.counts.dueCards, actions: [{ id: 'open-review', label: 'Open review', type: 'open_review' }] }],
    usedLLM: false,
  };
}

export async function getWeakAreas(ctx: ToolContext): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const goalId = ctx.goalId ?? ctx.state.activeGoal?.id ?? null;
  if (goalId) await ensureGoalForUser(ctx.supabase, ctx.userId, goalId);
  let query = ctx.supabase
    .from('concepts')
    .select('id, name, subject, chapter, topic, mastery, mastery_score, forgetting_probability')
    .eq('user_id', ctx.userId)
    .in('mastery', ['not_started', 'exposed', 'developing'])
    .order('forgetting_probability', { ascending: false })
    .limit(8);
  if (goalId) query = query.eq('goal_id', goalId);
  const { data, error } = await query;
  if (error) throw new Error('Unable to load weak areas.');
  return {
    cards: [{ type: 'weak_areas', topics: data ?? [], actions: [{ id: 'generate-quiz', label: 'Generate quiz', type: 'generate_quiz' }] }],
    usedLLM: false,
  };
}

export async function generateQuizForTopic(ctx: ToolContext, args: Record<string, unknown>): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const topic = safeTopic(ctx, args.topic);
  const subject = ctx.intent.entities.subject ?? ctx.state.activeGoal?.subject ?? 'General';
  const result = await budgetedGenerateJSON<z.infer<typeof QuizSchema>>({
    userId: ctx.userId,
    feature: 'tutor',
    route: '/api/hermes/command',
    model: 'flash',
    systemPrompt: 'Return only JSON for a short study quiz.',
    userPrompt: `Create 5 MCQs for ${subject}: ${topic}. Include options, correctAnswer, and a brief explanation.`,
    schema: QuizSchema,
    maxOutputTokens: 1200,
    metadata: buildHermesHeavyMetadata({
      intent: ctx.intent,
      reason: 'quiz generation requested',
      goalId: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
    }),
  });

  const { data: set } = await ctx.supabase
    .from('practice_sets')
    .insert({
      user_id: ctx.userId,
      goal_id: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
      topic,
      subject,
      set_type: 'mcq',
      source: 'hermes_ui',
    })
    .select('id')
    .single();

  if (set?.id) {
    try {
      await ctx.supabase.from('practice_items').insert(result.questions.map((question, index) => ({
        practice_set_id: set.id,
        user_id: ctx.userId,
        question: question.question,
        options: question.options,
        correct_answer: question.correctAnswer,
        explanation: question.explanation ?? null,
        subject,
        chapter: topic,
        topic,
        concept_name: topic,
        position: index + 1,
      })));
    } catch {
      // Non-fatal: the UI can still show the generated quiz card.
    }
  }

  return {
    cards: [{ type: 'quiz', title: `Quiz: ${topic}`, questions: result.questions, actions: [] }],
    usedLLM: true,
  };
}

export async function submitQuizAttempt(): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  return {
    cards: [clarificationCard('Open the quiz and submit your selected answers there.', ['Open review'])],
    usedLLM: false,
  };
}

export async function runMistakeAutopsy(ctx: ToolContext, args: Record<string, unknown>): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const question = typeof args.question === 'string' ? args.question : ctx.input;
  const myAnswer = typeof args.myAnswer === 'string' ? args.myAnswer : '';
  const correctAnswer = typeof args.correctAnswer === 'string' ? args.correctAnswer : '';

  if (!question || !myAnswer || !correctAnswer) {
    return {
      cards: [clarificationCard('Send the question, your answer, and the correct answer so Hermes can run an autopsy.', [
        'Question: ... My answer: ... Correct answer: ...',
      ])],
      usedLLM: false,
    };
  }

  let result;
  try {
    result = await runHermesMistakeAgent({
      userId: ctx.userId,
      goalId: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
      question,
      myAnswer,
      correctAnswer,
      goalTitle: ctx.state.activeGoal?.title ?? null,
      subjectHint: ctx.intent.entities.subject ?? ctx.state.activeGoal?.subject ?? null,
    });
  } catch {
    result = buildMistakeFallback({ question, myAnswer, correctAnswer });
  }

  return {
    cards: [{
      type: 'autopsy',
      title: result.weakConcept?.name ?? 'Mistake autopsy',
      diagnosis: result.diagnosis,
      nextActions: [result.nextAction?.label, result.keyMissedClue].filter(Boolean) as string[],
      actions: [{ id: 'open-autopsy', label: 'Open autopsy', type: 'run_autopsy' }],
    }],
    usedLLM: true,
  };
}

export async function createFlashcardsFromTopic(ctx: ToolContext, args: Record<string, unknown>): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const topic = safeTopic(ctx, args.topic);
  const subject = ctx.intent.entities.subject ?? ctx.state.activeGoal?.subject ?? 'General';
  const result = await budgetedGenerateJSON<z.infer<typeof FlashcardSchema>>({
    userId: ctx.userId,
    feature: 'rag_flashcard',
    route: '/api/hermes/command',
    model: 'flash',
    systemPrompt: 'Return only JSON flashcards.',
    userPrompt: `Create 6 concise active-recall flashcards for ${subject}: ${topic}.`,
    schema: FlashcardSchema,
    maxOutputTokens: 1000,
    metadata: buildHermesHeavyMetadata({
      intent: ctx.intent,
      reason: 'flashcard generation requested',
      goalId: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
    }),
  });

  const empty = createEmptyCard();
  const goalId = ctx.goalId ?? ctx.state.activeGoal?.id ?? null;
  const conceptResolution = await resolveConcept({
    userId: ctx.userId,
    goalId,
    subject,
    chapter: topic,
    topic,
    sourceType: 'revision',
    confidence: 0.85,
    client: ctx.supabase,
  });
  if (!conceptResolution.conceptId) {
    throw new Error('Flashcards could not be linked to a canonical concept.');
  }
  const rows = result.cards.map((card) => ({
    user_id: ctx.userId,
    goal_id: goalId,
    concept_id: conceptResolution.conceptId,
    front: card.front,
    back: card.back,
    subject,
    chapter: topic,
    due: empty.due.toISOString(),
    stability: empty.stability,
    difficulty: empty.difficulty,
    elapsed_days: empty.elapsed_days,
    scheduled_days: empty.scheduled_days,
    reps: empty.reps,
    lapses: empty.lapses,
    state: empty.state,
    source_type: 'hermes_ui',
  }));
  const { error: cardError } = await ctx.supabase.from('revision_cards').insert(rows);
  if (cardError) throw cardError;
  await invalidateSessionCard(ctx.userId, 'revision_cards_generated', {
    client: ctx.supabase,
    goalId,
  });

  return {
    cards: [{ type: 'flashcards', title: `Flashcards: ${topic}`, cards: result.cards, actions: [{ id: 'open-review', label: 'Open review', type: 'open_review' }] }],
    usedLLM: true,
  };
}

export async function askTutorWithContext(ctx: ToolContext): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const text = await budgetedGenerateText({
    userId: ctx.userId,
    feature: 'tutor',
    route: '/api/hermes/command',
    model: 'flash',
    systemPrompt: 'You are a concise tutor. Answer with source-aware caution when no source context is available.',
    userPrompt: ctx.input,
    maxOutputTokens: 500,
    metadata: buildHermesHeavyMetadata({
      intent: ctx.intent,
      reason: 'concept explanation requested',
      goalId: ctx.goalId ?? ctx.state.activeGoal?.id ?? null,
    }),
  });
  return { cards: [{ type: 'text', text }], usedLLM: true };
}

export async function summarizeProgress(ctx: ToolContext): Promise<{ cards: HermesCard[]; usedLLM: boolean }> {
  const counts = ctx.state.counts;
  const summary = ctx.state.activeGoal
    ? `${ctx.state.activeGoal.title}: ${counts.pendingMicrotasks} mission tasks, ${counts.dueCards} due cards, ${counts.weakConcepts} weak concepts, ${counts.recentMistakes} recent mistakes.`
    : 'Create a goal to unlock mission progress.';
  return {
    cards: [{
      type: 'progress_summary',
      summary,
      stats: counts,
      actions: [{ id: 'open-goal', label: 'Open goal', type: 'open_goal' }],
    }],
    usedLLM: false,
  };
}

export const hermesTools = {
  createGoalFromText,
  getOrCreateTodayMission,
  getSourceStatuses,
  retrySourceProcessing,
  getDueReviews,
  getWeakAreas,
  generateQuizForTopic,
  submitQuizAttempt,
  runMistakeAutopsy,
  createFlashcardsFromTopic,
  askTutorWithContext,
  summarizeProgress,
};

export type HermesToolName = keyof typeof hermesTools;
