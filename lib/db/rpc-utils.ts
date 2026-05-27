import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/utils/logger';

export async function hasMatchChatMemoryRpc(): Promise<boolean> {
  const supabase = await createClient();

  try {
    const zeroVector = `[${Array(768).fill(0).join(',')}]`;
    const { error } = await supabase.rpc('match_chat_memory', {
      query_embedding: zeroVector,
      p_user_id: '00000000-0000-0000-0000-000000000000',
      match_threshold: 0.99,
      match_count: 1,
    });

    if (!error) return true;

    const message = `${error.message || ''} ${error.details || ''}`;
    return !message.includes('function match_chat_memory') && error.code !== 'PGRST202';
  } catch (error: any) {
    const message = error?.message || '';
    if (message.includes('function match_chat_memory')) return false;
    logger.warn('Unexpected error while checking match_chat_memory RPC', error);
    return false;
  }
}
