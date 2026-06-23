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
  selectedMaterialIds?: string[];
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

  if (input.selectedMaterialIds && input.selectedMaterialIds.length > 0) {
    readyQuery = readyQuery.in('id', input.selectedMaterialIds);
  } else if (input.goalId && input.chatSessionId) {
    readyQuery = (readyQuery as any).or(`goal_id.eq.${input.goalId},chat_session_id.eq.${input.chatSessionId}`);
  } else if (input.goalId) {
    readyQuery = readyQuery.eq('goal_id', input.goalId);
  } else if (input.chatSessionId) {
    readyQuery = readyQuery.eq('chat_session_id', input.chatSessionId);
  }

  let { count } = await readyQuery;

  if ((count ?? 0) === 0 && input.goalId && (!input.selectedMaterialIds || input.selectedMaterialIds.length === 0)) {
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
        ragPromptBlock: `\n\nSOURCE-GROUNDED MODE: EXPLICIT\nSTATUS: PROCESSING\nSay exactly: "Your source is still processing. I can continue from built-in chapter memory for now." Do not imply uploaded-source grounding.`,
      };
    }

    const failedCount = await countFailedMaterials({
      supabase,
      userId: input.userId,
      goalId: input.goalId,
      chatSessionId: input.chatSessionId,
    });
    if (failedCount > 0) {
      return {
        ragContext: {
          mode: 'explicit', chunks: [], materialIds: [], chunkIds: [], totalContextChars: 0,
          grounded: false, evidenceStrength: 'none', warnings: ['Uploaded material failed to process.'],
        },
        ragPromptBlock: `\n\nSOURCE-GROUNDED MODE: EXPLICIT\nSTATUS: FAILED\nSay exactly: "Your source failed to process. Reprocess it from Sources."`,
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
    materialIds: input.selectedMaterialIds,
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

async function countFailedMaterials(input: {
  supabase: any;
  userId: string;
  goalId?: string | null;
  chatSessionId?: string | null;
}): Promise<number> {
  let query = input.supabase
    .from('study_materials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .in('status', ['failed', 'retryable_failed']);
  if (input.goalId && input.chatSessionId) query = (query as any).or(`goal_id.eq.${input.goalId},chat_session_id.eq.${input.chatSessionId}`);
  else if (input.goalId) query = query.eq('goal_id', input.goalId);
  else if (input.chatSessionId) query = query.eq('chat_session_id', input.chatSessionId);
  const { count, error } = await query;
  return error ? 0 : count ?? 0;
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
