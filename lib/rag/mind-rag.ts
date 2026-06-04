import { createAdminClient } from '@/lib/supabase/admin';
import { inferRagMode, isExplicitRagRequest, retrieveRagContext } from './retrieval';
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
  const explicitRequest = isExplicitRagRequest(input.message);

  if (!hasReadyMaterials && explicitRequest) {
    const processingCount = await countProcessingMaterials({
      supabase,
      userId: input.userId,
      goalId: input.goalId,
      chatSessionId: input.chatSessionId,
    });

    if (processingCount > 0) {
      return {
        ragContext: {
          mode: 'explicit',
          chunks: [],
          materialIds: [],
          chunkIds: [],
          totalContextChars: 0,
          grounded: false,
          evidenceStrength: 'none',
          warnings: ['Uploaded material is still processing.'],
        },
        ragPromptBlock: `\n\nSOURCE-GROUNDED MODE: EXPLICIT\nSTATUS: PROCESSING\nInstruct the AI to say exactly: "Your material is still processing. I can answer generally for now, or you can retry once it is ready." Do not invent citations or imply uploaded-source grounding.`,
      };
    }
  }

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

async function countProcessingMaterials(input: {
  supabase: any;
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
}): Promise<number> {
  let query = input.supabase
    .from('study_materials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .in('status', ['uploaded', 'queued', 'processing']);

  if (input.goalId && input.chatSessionId) {
    query = (query as any).or(`goal_id.eq.${input.goalId},chat_session_id.eq.${input.chatSessionId}`);
  } else if (input.goalId) {
    query = query.eq('goal_id', input.goalId);
  } else if (input.chatSessionId) {
    query = query.eq('chat_session_id', input.chatSessionId);
  }

  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}
