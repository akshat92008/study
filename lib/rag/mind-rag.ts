import { createAdminClient } from '@/lib/supabase/admin';
import { inferRagMode, retrieveRagContext } from './retrieval';
import { formatRagContextForPrompt } from './citations';
import type { RagContext } from './types';

export async function buildMindRagContext(input: {
  userId: string;
  message: string;
  subject?: string | null;
  chapter?: string | null;
  goalId?: string | null;
  chatSessionId?: string | null;
}): Promise<{
  ragContext: RagContext;
  ragPromptBlock: string;
}> {
  const supabase = createAdminClient();

  let readyQuery = supabase
    .from('study_materials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .eq('status', 'ready');

  if (input.goalId) readyQuery = readyQuery.eq('goal_id', input.goalId);

  let { count } = await readyQuery;

  if ((count ?? 0) === 0 && input.goalId) {
    const fallback = await supabase
      .from('study_materials')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', input.userId)
      .eq('status', 'ready');
    count = fallback.count;
  }

  const hasReadyMaterials = (count ?? 0) > 0;
  const mode = inferRagMode(input.message, hasReadyMaterials);

  const ragContext = await retrieveRagContext({
    userId: input.userId,
    query: input.message,
    mode,
    subject: input.subject ?? undefined,
    chapter: input.chapter ?? undefined,
    goalId: input.goalId,
    chatSessionId: input.chatSessionId,
  });

  let ragPromptBlock = formatRagContextForPrompt(ragContext);

  if (ragContext.mode === 'explicit' && !ragContext.grounded) {
    ragPromptBlock = `\n\nSOURCE-GROUNDED MODE: EXPLICIT\nSTATUS: NOT FOUND\nInstruct the AI: Tell the user clearly: "I could not find this in your uploaded material." Then, if you have general knowledge, provide it separately. DO NOT hallucinate citations.`;
  }

  return {
    ragContext,
    ragPromptBlock,
  };
}
