import { hermesTools } from './tools';
import type { HermesPlan, HermesUserState, HermesIntent } from './types';

export async function executeHermesPlan(input: {
  supabase: any;
  userId: string;
  goalId?: string | null;
  intent: HermesIntent;
  state: HermesUserState;
  message: string;
  plan: HermesPlan;
}): Promise<HermesPlan> {
  const cards = [...input.plan.cards];
  const warnings = [...input.plan.warnings];
  let usedLLM = input.plan.usedLLM;

  for (const toolCall of input.plan.tools) {
    const tool = hermesTools[toolCall.name];
    if (!tool) {
      warnings.push(`unknown_tool:${toolCall.name}`);
      continue;
    }

    try {
      const result = await tool({
        supabase: input.supabase,
        userId: input.userId,
        goalId: input.goalId,
        intent: input.intent,
        state: input.state,
        input: input.message,
      } as any, toolCall.args as any);
      cards.push(...result.cards);
      usedLLM = usedLLM || result.usedLLM;
    } catch (error: any) {
      warnings.push(`tool_failed:${toolCall.name}`);
      cards.push({
        type: 'text',
        text: error?.message && !/supabase|postgres|sql|stack/i.test(error.message)
          ? error.message
          : 'Hermes could not complete that command right now.',
      });
    }
  }

  return {
    cards,
    tools: input.plan.tools,
    usedLLM,
    costMode: usedLLM ? 'heavy' : input.plan.costMode,
    warnings,
  };
}
