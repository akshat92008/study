import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';

type UsageKind = 'chat' | 'autopsy' | 'image';

const ESTIMATED_COST_PER_1K_TOKENS: Record<string, number> = {
  chat: 0.0001,
  autopsy: 0.0002,
  image: 0.0003,
};

export async function trackDailyAIUsage(input: {
  userId: string;
  kind: UsageKind;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCost?: number;
}): Promise<void> {
  const supabase = createAdminClient();
  const usageDate = new Date().toISOString().split('T')[0];
  const promptTokens = Math.max(0, Math.round(input.promptTokens ?? 0));
  const completionTokens = Math.max(0, Math.round(input.completionTokens ?? 0));
  const totalTokens = promptTokens + completionTokens;
  const estimatedCost = input.estimatedCost ??
    (totalTokens / 1000) * ESTIMATED_COST_PER_1K_TOKENS[input.kind];

  const increments = {
    chat_calls: input.kind === 'chat' ? 1 : 0,
    autopsy_calls: input.kind === 'autopsy' ? 1 : 0,
    image_calls: input.kind === 'image' ? 1 : 0,
  };

  const { data: existing, error: readError } = await supabase
    .from('ai_usage_daily')
    .select('id, chat_calls, autopsy_calls, image_calls, prompt_tokens, completion_tokens, total_tokens, estimated_cost')
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
    return;
  }

  const { error } = await supabase
    .from('ai_usage_daily')
    .update({
      chat_calls: (existing.chat_calls || 0) + increments.chat_calls,
      autopsy_calls: (existing.autopsy_calls || 0) + increments.autopsy_calls,
      image_calls: (existing.image_calls || 0) + increments.image_calls,
      prompt_tokens: (existing.prompt_tokens || 0) + promptTokens,
      completion_tokens: (existing.completion_tokens || 0) + completionTokens,
      total_tokens: (existing.total_tokens || 0) + totalTokens,
      estimated_cost: Number(existing.estimated_cost || 0) + estimatedCost,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id);

  if (error) logger.error('Failed to update daily AI usage', error, { userId: input.userId });
}
