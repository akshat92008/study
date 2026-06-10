import type { SupabaseClient } from '@supabase/supabase-js';
import { runHermesTurn } from '@/lib/agent/runtime';

export async function reviewRecentConversation(input: {
  supabase: SupabaseClient;
  userId: string;
  conversationId?: string | null;
  sessionId?: string | null;
  goalId?: string | null;
}) {
  const { data: messages } = await input.supabase
    .from('chat_messages')
    .select('role, content')
    .eq('user_id', input.userId)
    .eq('session_id', input.sessionId ?? input.conversationId)
    .order('created_at', { ascending: false })
    .limit(10);

  const text = (messages ?? []).reverse().map((message: any) => `${message.role}: ${message.content}`).join('\n');
  return runHermesTurn({
    userId: input.userId,
    channel: 'chat',
    userMessage: text || 'Review recent conversation',
    conversationId: input.conversationId ?? undefined,
    sessionId: input.sessionId ?? undefined,
    goalId: input.goalId ?? undefined,
  }, {
    supabase: input.supabase,
    idempotencyKey: `background-conversation:${input.userId}:${input.sessionId ?? input.conversationId ?? 'global'}:${new Date().toISOString().slice(0, 10)}`,
    finalResponse: 'Background review completed.',
    maxToolCalls: 20,
  });
}

