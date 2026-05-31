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
    set({ chatMessages: [], pendingSyncQueue: [] });
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
      const response = await fetch('/api/ai/chat', {
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

      // Initialize Realtime Sync
      get().subscribeToRealtime();
    } catch (err) {
      console.error('Failed to load chat:', err);
    } finally {
      set({ isChatLoading: false });
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
