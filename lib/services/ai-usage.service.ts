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
const reservationsByUserAndKind = new Map<string, string[]>();

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

function reservationKey(userId: string, kind: UsageKind): string {
  return `${userId}:${kind}`;
}

function rememberReservation(userId: string, kind: UsageKind, reservationId: string): void {
  const key = reservationKey(userId, kind);
  const queue = reservationsByUserAndKind.get(key) ?? [];
  queue.push(reservationId);
  reservationsByUserAndKind.set(key, queue);
}

function takeReservation(userId: string, kind: UsageKind): string | null {
  const key = reservationKey(userId, kind);
  const queue = reservationsByUserAndKind.get(key) ?? [];
  const reservationId = queue.shift() ?? null;
  if (queue.length > 0) reservationsByUserAndKind.set(key, queue);
  else reservationsByUserAndKind.delete(key);
  return reservationId;
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
  // Deep reflection bypass fix: Add 1500 tokens to completion estimate to account for <reflection> blocks
  const REFLECTION_ALLOWANCE = 1500;
  const completionTokens = (input.estimatedCompletionTokens ?? 0) + REFLECTION_ALLOWANCE;

  const estimatedCost = estimateCost(
    input.kind,
    input.estimatedPromptTokens,
    completionTokens,
    input.estimatedCost
  );
  const limit = getDailyBudgetUsd();

  // Basic read-only check before making the API call
  const { data: usage } = await supabase
    .from('ai_usage_daily')
    .select('estimated_cost')
    .eq('user_id', input.userId)
    .eq('usage_date', new Date().toISOString().split('T')[0])
    .maybeSingle();

  if (usage && (usage.estimated_cost || 0) + estimatedCost > limit) {
    throw new AIUsageBudgetExceededError(limit, limit, estimatedCost);
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
  const promptTokens = Math.max(0, Math.round(input.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(input.completionTokens ?? 0));
  const estimatedCost = estimateCost(input.kind, promptTokens, completionTokens, input.estimatedCost);

  const { error } = await supabase.rpc('atomic_ai_budget_spend', {
    p_user_id: input.userId,
    p_feature: input.kind,
    p_model: input.model || 'unknown',
    p_cost: estimatedCost,
    p_prompt_tokens: promptTokens,
    p_completion_tokens: completionTokens,
    p_route: input.route || 'unknown',
    p_daily_limit_usd: getDailyBudgetUsd(),
  });

  if (error) {
    logger.error('Failed to commit atomic AI usage', error, { userId: input.userId });
  }
}
