// lib/services/chat-persistence.ts
//
// MODULE 3 PATCH: persistChatMessage now returns { id } so callers can thread
// the assistant_message_id into downstream events. It also accepts an optional
// idempotencyKey; when the unique index fires (duplicate write), it returns the
// existing row's id instead of throwing — making all writes idempotent.

export type ChatMessageForPrompt = { role: 'user' | 'assistant' | 'system'; content: string };
export type ChatMessageForClient = ChatMessageForPrompt & {
  id: string;
  timestamp: string;
  metadata?: Record<string, any>;
};

export async function getOrCreateChatSession(
  supabase: any,
  userId: string,
  sessionType: string,
  title: string
): Promise<string> {
  const { data: existing, error: existingError } = await supabase
    .from('chat_sessions')
    .select('id')
    .eq('user_id', userId)
    .eq('session_type', sessionType)
    .maybeSingle();

  if (existingError) {
    throw new Error(`Failed to load ${sessionType} chat session: ${existingError.message}`);
  }
  if (existing?.id) return existing.id;

  const { data: created, error: createError } = await supabase
    .from('chat_sessions')
    .insert({
      user_id: userId,
      session_type: sessionType,
      is_global: sessionType === 'global',
      title,
    })
    .select('id')
    .single();

  if (createError || !created?.id) {
    throw new Error(`Failed to create ${sessionType} chat session: ${createError?.message || 'missing id'}`);
  }

  return created.id;
}

export async function getOrCreateGlobalChatSession(supabase: any, userId: string): Promise<string> {
  return getOrCreateChatSession(supabase, userId, 'global', 'Cognition OS Main Thread');
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

export async function loadRecentMessagesForClient(
  supabase: any,
  sessionId: string
): Promise<ChatMessageForClient[]> {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('id, role, content, metadata, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(`Failed to load chat history: ${error.message}`);
  }

  return (data || [])
    .reverse()
    .map((m: any) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      timestamp: m.created_at,
      metadata: m.metadata ?? {},
    }))
    .filter((m: any) => ['user', 'assistant', 'system'].includes(m.role) && typeof m.content === 'string');
}

// ---------------------------------------------------------------------------
// persistChatMessage
//
// Returns { id } of the inserted (or, on idempotency conflict, existing) row.
// The caller should thread this id into any CHAT_MESSAGE_PROCESSED event so
// the worker can reference the message without re-inserting it.
// ---------------------------------------------------------------------------
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
    promptVersion?: string;
    /** Deterministic key for assistant messages: "<requestId>:assistant".
     *  When set, a second insert with the same key silently returns the existing id. */
    idempotencyKey?: string;
  }
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      session_id: input.sessionId,
      user_id: input.userId,
      role: input.role,
      content: input.content,
      intent: input.intent ?? null,
      emotional_state: input.emotionalState ?? null,
      metadata: input.metadata ?? {},
      prompt_version: input.promptVersion ?? null,
      idempotency_key: input.idempotencyKey ?? null,
    })
    .select('id')
    .single();

  if (error) {
    // PostgreSQL unique_violation = 23505.
    // This means the route (or a retry) already inserted this assistant message.
    // Return the existing row's id — caller still gets a valid reference.
    if (error.code === '23505' && input.idempotencyKey) {
      const { data: existing, error: lookupErr } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('user_id', input.userId)
        .eq('idempotency_key', input.idempotencyKey)
        .maybeSingle();

      if (!lookupErr && existing?.id) {
        return { id: existing.id };
      }
    }
    throw new Error(`Failed to persist ${input.role} chat message: ${error.message}`);
  }

  // Best-effort session timestamp update — never throws
  await supabase
    .from('chat_sessions')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', input.sessionId)
    .eq('user_id', input.userId)
    .then(({ error: updateError }: any) => {
      if (updateError) {
        console.warn('[chat-persistence] Failed to update session timestamp:', updateError.message);
      }
    });

  return { id: data.id };
}

export function stripMetadataBlock(content: string): string {
  return content.replace(/\n\n===METADATA===\n[\s\S]*/g, '').trim();
}
