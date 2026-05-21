import { StateCreator } from 'zustand';
import { createClient } from '@/lib/supabase/client';

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  metadata?: any;
}

export interface ChatSlice {
  // State
  chatId: string | null;
  chatMessages: ChatMessage[];
  pendingSyncQueue: ChatMessage[];
  isChatLoading: boolean;

  // Actions
  setChatId: (id: string | null) => void;
  addChatMessage: (message: ChatMessage) => void;
  setChatMessages: (messages: ChatMessage[]) => void;
  
  // Async Thunks
  loadChatFromSupabase: () => Promise<void>;
  syncPendingQueue: () => Promise<void>;
  syncChatToSupabase: () => Promise<void>;
  subscribeToRealtime: () => void;
  clearChat: () => void;
}

const INITIAL_MSG: ChatMessage = {
  role: 'assistant',
  content: `Welcome to **Cognition OS**. I am your central COMMAND intelligence.
 
Here is how your study environment is structured:
• 🧠 **ATLAS** (Cognition Graph) — Visualizes your real-time mastery across all concepts.
• 🃏 **MEMORY** (Spaced Repetition) — A smart flashcard queue powered by FSRS-5.
• 🔬 **AUTOPSY** (Mistake Ingester) — Upload mock tests to diagnose and fix conceptual mistakes.
• 📅 **PLANNER** (Adaptive Schedule) — Your daily study blocks, optimized by priority and memory retention curves.
 
To get started, tell me what you want to learn, prepare for, or master.`,
  timestamp: new Date().toISOString(),
};

let activeRealtimeChannel: any = null;

export const createChatSlice: StateCreator<ChatSlice, [["zustand/persist", unknown]], [], ChatSlice> = (set, get) => ({
  chatId: null,
  chatMessages: [INITIAL_MSG],
  pendingSyncQueue: [],
  isChatLoading: false,

  setChatId: (id) => set({ chatId: id }),
  
  setChatMessages: (messages) => set({ chatMessages: messages }),
  
  addChatMessage: (message) => {
    // Optimistic UI update + enqueue for sync
    set((state) => ({
      chatMessages: [...state.chatMessages, message],
      pendingSyncQueue: [...state.pendingSyncQueue, message]
    }));
    // Trigger async sync without blocking
    get().syncPendingQueue();
  },

  clearChat: () => {
    set({ chatMessages: [INITIAL_MSG], pendingSyncQueue: [] });
    // In a real scenario we'd create a new session ID here
    set({ chatId: null });
    
    // Clean up channel on clear
    if (activeRealtimeChannel) {
      const supabase = createClient();
      supabase.removeChannel(activeRealtimeChannel);
      activeRealtimeChannel = null;
    }

    get().loadChatFromSupabase(); // Will create a new session
  },

  loadChatFromSupabase: async () => {
    set({ isChatLoading: true });
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        set({ isChatLoading: false });
        return;
      }

      // Try reading from new table first
      let sessionId = get().chatId;
      
      if (!sessionId) {
        // Fetch or create a global session
        const { data: session } = await supabase
          .from('chat_sessions')
          .select('id')
          .eq('user_id', user.id)
          .eq('session_type', 'global')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (session) {
          sessionId = session.id;
          set({ chatId: sessionId });
        } else {
          // Attempt to create
          const { data: newSession } = await supabase
            .from('chat_sessions')
            .insert({ user_id: user.id, session_type: 'global', title: 'Cognition OS Main Thread' })
            .select('id')
            .single();
          
          if (newSession) {
            sessionId = newSession.id;
            set({ chatId: sessionId });
          }
        }
      }

      if (sessionId) {
        // Load last 50 messages
        const { data: messages, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('session_id', sessionId)
          .order('created_at', { ascending: false })
          .limit(50);

        if (!error && messages && messages.length > 0) {
          // Reverse to display chronologically
          const chronological = messages.reverse().map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant' | 'system',
            content: m.content,
            timestamp: m.created_at,
            metadata: m.metadata
          }));
          set({ chatMessages: chronological });
        } else if (error?.code === '42P01') {
           // relation does not exist
           console.warn('chat_messages table not found. Using fallback.');
           // Wait, we should implement fallback to orchestrator_chats here if we want zero-breakage
        }
      }

      // Initialize Realtime Sync
      get().subscribeToRealtime();
    } catch (err) {
      console.error('Failed to load chat:', err);
    } finally {
      set({ isChatLoading: false });
    }
  },

  syncPendingQueue: async () => {
    const queue = get().pendingSyncQueue;
    if (queue.length === 0) return;
    
    const sessionId = get().chatId;
    if (!sessionId) return; // Cant sync without a session

    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const recordsToInsert = queue.map(msg => ({
        session_id: sessionId,
        user_id: user.id,
        role: msg.role,
        content: msg.content,
        created_at: msg.timestamp,
        metadata: msg.metadata || {}
      }));

      const { error } = await supabase
        .from('chat_messages')
        .insert(recordsToInsert);

      if (!error) {
        // Clear queue on success
        set({ pendingSyncQueue: [] });
      } else {
        console.error('Failed to sync chat messages', error);
      }
    } catch (err) {
      console.error('Error syncing chat messages', err);
    }
  },

  syncChatToSupabase: async () => {
    // Backward compatibility alias for legacy UI calls
    return get().syncPendingQueue();
  },

  subscribeToRealtime: () => {
    const sessionId = get().chatId;
    if (!sessionId) return;

    const supabase = createClient();
    
    // Clean up any existing active channel subscription first
    if (activeRealtimeChannel) {
      supabase.removeChannel(activeRealtimeChannel);
      activeRealtimeChannel = null;
    }

    const channel = supabase.channel(`chat_messages_${sessionId}`);
    
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `session_id=eq.${sessionId}` },
      (payload) => {
        // Prevent duplicates if we already optimistic-UI'd this message
        const currentMessages = get().chatMessages;
        const isDuplicate = currentMessages.some(m => 
          m.id === payload.new.id || 
          (m.content === payload.new.content && m.timestamp === payload.new.created_at)
        );
        
        if (!isDuplicate) {
          set((state) => ({
            chatMessages: [...state.chatMessages, {
              id: payload.new.id,
              role: payload.new.role,
              content: payload.new.content,
              timestamp: payload.new.created_at,
              metadata: payload.new.metadata
            }]
          }));
        }
      }
    );
    
    channel.subscribe();
    activeRealtimeChannel = channel;
  }
});
