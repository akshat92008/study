import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

type UsageKind = 'chat' | 'autopsy' | 'image' | 'planner' | 'session-card';

const ESTIMATED_COST_PER_1K_TOKENS: Record<string, number> = {
  chat: 0.0001,
  autopsy: 0.0002,
  image: 0.0003,
  planner: 0.00015,
  'session-card': 0.00005,
};

const DAILY_BUDGET_ENV = 'AI_DAILY_USER_BUDGET_USD';
const DEFAULT_DAILY_BUDGET_USD = 0.25;

export class AIUsageBudgetExceededError extends Error {
  readonly status = 429;
  readonly code = 'AI_DAILY_BUDGET_EXCEEDED';

  constructor(
    readonly limitUsd: number,
    readonly usedUsd: number,
    readonly estimatedRequestCostUsd: number
  ) {
    super('Daily AI budget exceeded');
  }
}

function getDailyBudgetUsd(): number {
  const configured = Number(process.env[DAILY_BUDGET_ENV]);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_DAILY_BUDGET_USD;
}

function estimateCost(kind: UsageKind, promptTokens = 0, completionTokens = 0, override?: number): number {
  if (override !== undefined) return Math.max(0, override);
  const totalTokens = Math.max(0, Math.round(promptTokens + completionTokens));
  return (totalTokens / 1000) * ESTIMATED_COST_PER_1K_TOKENS[kind];
}

export function isAIUsageBudgetExceeded(error: unknown): error is AIUsageBudgetExceededError {
  return error instanceof AIUsageBudgetExceededError;
}

export async function assertDailyAIUsageBudget(input: {
  userId: string;
  kind: UsageKind;
  estimatedPromptTokens?: number;
  estimatedCompletionTokens?: number;
  estimatedCost?: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const usageDate = new Date().toISOString().split('T')[0];
  const estimatedCost = estimateCost(
    input.kind,
    input.estimatedPromptTokens,
    input.estimatedCompletionTokens,
    input.estimatedCost
  );
  const limit = getDailyBudgetUsd();

  const { data, error } = await supabase
    .from('ai_usage_daily')
    .select('estimated_cost')
    .eq('user_id', input.userId)
    .eq('usage_date', usageDate)
    .maybeSingle();

  if (error) {
    logger.error('Failed to enforce AI usage budget', error, { userId: input.userId });
    throw new AIUsageBudgetExceededError(limit, limit, estimatedCost);
  }

  const used = Number(data?.estimated_cost || 0);
  if (used + estimatedCost > limit) {
    throw new AIUsageBudgetExceededError(limit, used, estimatedCost);
  }
}

export async function trackDailyAIUsage(input: {
  userId: string;
  kind: UsageKind;
  route?: string;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCost?: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const usageDate = new Date().toISOString().split('T')[0];
  const promptTokens = Math.max(0, Math.round(input.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(input.completionTokens ?? 0));
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = estimateCost(input.kind, promptTokens, completionTokens, input.estimatedCost);

  const increments = {
    chat_calls: input.kind === 'chat' ? 1 : 0,
    autopsy_calls: input.kind === 'autopsy' ? 1 : 0,
    image_calls: input.kind === 'image' ? 1 : 0,
    planner_calls: input.kind === 'planner' ? 1 : 0,
    session_card_calls: input.kind === 'session-card' ? 1 : 0,
  };

  const { data: existing, error: readError } = await supabase
    .from('ai_usage_daily')
    .select('id, chat_calls, autopsy_calls, image_calls, planner_calls, session_card_calls, prompt_tokens, completion_tokens, total_tokens, estimated_cost')
    .eq('user_id', input.userId)
    .eq('usage_date', usageDate)
    .maybeSingle();

  if (readError) {
    logger.error('Failed to read daily AI usage', readError, { userId: input.userId });
    return;
  }

  if (!existing) {
    const { error } = await supabase.from('ai_usage_daily').insert({
      user_id: input.userId,
      usage_date: usageDate,
      ...increments,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost: estimatedCost,
    });
    if (error) logger.error('Failed to insert daily AI usage', error, { userId: input.userId });
    await insertUsageEvent(input, usageDate, promptTokens, completionTokens, totalTokens, estimatedCost);
    return;
  }

  const { error } = await supabase
    .from('ai_usage_daily')
    .update({
      chat_calls: (existing.chat_calls || 0) + increments.chat_calls,
      autopsy_calls: (existing.autopsy_calls || 0) + increments.autopsy_calls,
      image_calls: (existing.image_calls || 0) + increments.image_calls,
      planner_calls: (existing.planner_calls || 0) + increments.planner_calls,
      session_card_calls: (existing.session_card_calls || 0) + increments.session_card_calls,
      prompt_tokens: (existing.prompt_tokens || 0) + promptTokens,
      completion_tokens: (existing.completion_tokens || 0) + completionTokens,
      total_tokens: (existing.total_tokens || 0) + totalTokens,
      estimated_cost: Number(existing.estimated_cost || 0) + estimatedCost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (error) logger.error('Failed to update daily AI usage', error, { userId: input.userId });
  await insertUsageEvent(input, usageDate, promptTokens, completionTokens, totalTokens, estimatedCost);
}

async function insertUsageEvent(
  input: {
    userId: string;
    kind: UsageKind;
    route?: string;
    model?: string;
  },
  usageDate: string,
  promptTokens: number,
  completionTokens: number,
  totalTokens: number,
  estimatedCost: number
) {
  const supabase = createAdminClient();
  const { error } = await supabase.from('ai_usage_events').insert({
    user_id: input.userId,
    usage_date: usageDate,
    feature: input.kind,
    route: input.route || 'unknown',
    model: input.model || 'unknown',
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    estimated_cost: estimatedCost,
  });

  if (error) logger.warn('Failed to insert AI usage event', { error, userId: input.userId });
}
