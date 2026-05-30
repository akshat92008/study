export type ChatMessageForPrompt = { role: 'user' | 'assistant' | 'system'; content: string };

export async function getOrCreateGlobalChatSession(supabase: any, userId: string): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('session_type', 'global')
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load global chat session: ${existingError.message}`);
  }
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      session_type: 'global',
      is_global: true,
      title: 'Cognition OS Main Thread',
    })
    .select('id')
    .single();

  if (createError || !created?.id) {
    throw new Error(`Failed to create global chat session: ${createError?.message || 'missing id'}`);
  }

  return created.id;
}

export async function loadRecentMessages(supabase: any, sessionId: string): Promise<ChatMessageForPrompt[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load chat history: ${error.message}`);
  }

  return (data || [])
    .reverse()
    .map((m: any) => ({ role: m.role, content: m.content }))
    .filter((m: any) => ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string');
}

export async function persistChatMessage(
  supabase: any,
  input: {
    sessionId: string;
    userId: string;
    role: 'user' | 'assistant';
    content: string;
    metadata?: Record<string, any>;
    intent?: string;
    emotionalState?: string;
  }
) {
  const { error } = await supabase.from('chat_messages').insert({
    session_id: input.sessionId,
    user_id: input.userId,
    role: input.role,
    content: input.content,
    intent: input.intent ?? null,
    emotional_state: input.emotionalState ?? null,
    metadata: input.metadata ?? {},
  });

  if (error) {
    throw new Error(`Failed to persist ${input.role} chat message: ${error.message}`);
  }

  const { error: updateError } = await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.sessionId)
    .eq('user_id', input.userId);

  if (updateError) {
    throw new Error(`Failed to update chat session timestamp: ${updateError.message}`);
  }
}

export function stripMetadataBlock(content: string): string {
  return content.replace(/\n\n===METADATA===\n[\s\S]*/g, '').trim();
}
