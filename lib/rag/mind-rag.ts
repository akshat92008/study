import { createAdminClient } from '@/lib/supabase/admin';
import { inferRagMode, retrieveRagContext } from './retrieval';
import { formatRagContextForPrompt } from './citations';
import type { RagContext } from './types';

export async function buildMindRagContext(input: {
  userId: string;
  message: string;
  subject?: string | null;
  chapter?: string | null;
}): Promise<{
  ragContext: RagContext;
  ragPromptBlock: string;
}> {
  const supabase = createAdminClient();

  const { count } = await supabase
    .from('study_materials')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', input.userId)
    .eq('status', 'ready');

  const hasReadyMaterials = (count ?? 0) > 0;
  const mode = inferRagMode(input.message, hasReadyMaterials);

  const ragContext = await retrieveRagContext({
    userId: input.userId,
    query: input.message,
    mode,
    subject: input.subject ?? undefined,
    chapter: input.chapter ?? undefined,
  });

  return {
    ragContext,
    ragPromptBlock: formatRagContextForPrompt(ragContext),
  };
}
