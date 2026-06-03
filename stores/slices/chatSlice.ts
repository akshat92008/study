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
  loadChatFromSupabase: (id?: string) => Promise<void>;
  syncPendingQueue: () => Promise<void>;
  syncChatToSupabase: () => Promise<void>;
  subscribeToRealtime: () => void;
  clearChat: () => void;

  // Sessions
  sessions: any[];
  isSessionsLoading: boolean;
  loadSessions: () => Promise<void>;
  createNewSession: () => Promise<void>;
  selectSession: (id: string) => Promise<void>;
  renameSession: (id: string, title: string) => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
}

let activeRealtimeChannel: any = null;

// Properly typed Zustand slice creator
export const createChatSlice: StateCreator<
  ChatSlice,
  [],
  [],
  ChatSlice
> = (set, get) => ({
  chatId: null,
  chatMessages: [],
  pendingSyncQueue: [],
  isChatLoading: false,
  sessions: [],
  isSessionsLoading: false,

  setChatId: (id) => set({ chatId: id }),
  setChatMessages: (messages) => set({ chatMessages: messages }),
  
  addChatMessage: (message) => {
    // Optimistic UI update (server handles persistence)
    const optimisticMsg = { ...message, id: message.id || `temp-${Date.now()}` };
    set((state) => ({
      chatMessages: [...state.chatMessages, optimisticMsg],
      pendingSyncQueue: [] // Disabled direct sync queue
    }));
  },

  clearChat: () => {
    const currentChatId = get().chatId;
    set({ chatMessages: [], pendingSyncQueue: [] });
    
    // Clean up channel on clear
    if (activeRealtimeChannel) {
      const supabase = createClient();
      supabase.removeChannel(activeRealtimeChannel);
      activeRealtimeChannel = null;
    }

    get().loadChatFromSupabase(currentChatId || undefined);
  },

  loadChatFromSupabase: async (id?: string) => {
    set({ isChatLoading: true });
    try {
      const activeGoalId = (get() as any).activeGoalId;
      const params = new URLSearchParams();
      if (id) params.set('chatId', id);
      if (activeGoalId) params.set('activeGoalId', activeGoalId);
      const url = `/api/ai/chat${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });

      if (!response.ok) {
        set({ chatId: null, chatMessages: [] });
        return;
      }

      const data = await response.json();
      const sessionId = data.sessionId ?? null;
      const messages = Array.isArray(data.messages) ? data.messages : [];

      set({
        chatId: sessionId,
        chatMessages: messages.map((m: any) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant' | 'system',
          content: m.content,
          timestamp: m.timestamp,
          metadata: m.metadata ?? {},
        })),
      });
      if (data.goalId !== undefined) {
        (set as any)({ activeGoalId: data.goalId ?? activeGoalId ?? null });
      }

      // Initialize Realtime Sync
      get().subscribeToRealtime();
    } catch (err) {
      console.error('Failed to load chat:', err);
    } finally {
      set({ isChatLoading: false });
    }
  },

  loadSessions: async () => {
    set({ isSessionsLoading: true });
    try {
      const response = await fetch('/api/chat/sessions', { method: 'GET' });
      if (response.ok) {
        const data = await response.json();
        set({ sessions: data.sessions || [] });
      }
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      set({ isSessionsLoading: false });
    }
  },

  createNewSession: async () => {
    try {
      const activeGoalId = (get() as any).activeGoalId;
      const response = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(activeGoalId
          ? { title: 'New Chat', goalId: activeGoalId, sessionType: 'quick' }
          : { title: 'New Chat' }),
      });
      if (response.ok) {
        const data = await response.json();
        await get().loadSessions();
        await get().selectSession(data.session.id);
      }
    } catch (err) {
      console.error('Failed to create session:', err);
    }
  },

  selectSession: async (id: string) => {
    if (activeRealtimeChannel) {
      const supabase = createClient();
      supabase.removeChannel(activeRealtimeChannel);
      activeRealtimeChannel = null;
    }
    set({ chatId: id, chatMessages: [] });
    await get().loadChatFromSupabase(id);
  },

  renameSession: async (id: string, title: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${id}`, { method: 'PATCH', body: JSON.stringify({ title }) });
      if (response.ok) {
        await get().loadSessions();
      }
    } catch (err) {
      console.error('Failed to rename session:', err);
    }
  },

  deleteSession: async (id: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (response.ok) {
        await get().loadSessions();
        if (get().chatId === id) {
          get().clearChat();
        }
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  },

  syncPendingQueue: async () => {
    // Disabled direct Supabase insert for MVP.
    // Server route (app/api/ai/chat) handles all persistence.
    const queue = get().pendingSyncQueue;
    if (queue.length > 0) {
      set({ pendingSyncQueue: [] });
    }
    return Promise.resolve();
  },

  syncChatToSupabase: async () => {
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
        const isDuplicate = currentMessages.some(m => {
          if (m.id === payload.new.id) return true;
          
          if (typeof m.content === 'string' && typeof payload.new.content === 'string') {
            if (m.content.trim() === payload.new.content.trim() && m.role === payload.new.role) {
              const timeDiff = Math.abs(new Date(m.timestamp).getTime() - new Date(payload.new.created_at).getTime());
              return timeDiff < 15000; // 15 seconds window for optimistic UI match
            }
          }
          
          return false;
        });
        
        if (!isDuplicate) {
          set((state) => ({
            chatMessages: [...state.chatMessages, {
              id: payload.new.id,
              role: payload.new.role as any,
              content: payload.new.content,
              timestamp: payload.new.created_at,
              metadata: payload.new.metadata
            }]
          }));
        } else {
          // If it's an optimistic duplicate, update its temporary ID to the real database ID
          set((state) => ({
            chatMessages: state.chatMessages.map(m => {
              if (m.id === payload.new.id) return m;
              if (typeof m.content === 'string' && typeof payload.new.content === 'string') {
                if (m.content.trim() === payload.new.content.trim() && m.role === payload.new.role) {
                  return { ...m, id: payload.new.id };
                }
              }
              return m;
            })
          }));
        }
      }
    );
    
    channel.subscribe();
    activeRealtimeChannel = channel;
  }
});
