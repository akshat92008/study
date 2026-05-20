import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

interface AppState {
  // Command Bar
  isCommandBarOpen: boolean;
  setCommandBarOpen: (open: boolean) => void;
  toggleCommandBar: () => void;
  
  // Global Assistant (Copilot)
  isAssistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  toggleAssistant: () => void;
  
  // Toasts
  toastQueue: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // Session Telemetry (PULSE)
  sessionActive: boolean;
  sessionStartTime: number | null;
  startSession: () => void;
  endSession: () => number;

  // Sidebar
  isSidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  isMobileSidebarOpen: boolean;
  setMobileSidebarOpen: (open: boolean) => void;
  toggleMobileSidebar: () => void;

  // Real-time Dashboard Telemetry
  currentActiveTask: any;
  setCurrentActiveTask: (task: any) => void;
  activeTasksList: any[];
  setActiveTasksList: (tasks: any[]) => void;
  emotionalState: string;
  setEmotionalState: (state: string) => void;
  atlasMastery: number;
  setAtlasMastery: (mastery: number) => void;
  memoryDueCount: number;
  setMemoryDueCount: (count: number) => void;
  autopsyLossPoints: number;
  setAutopsyLossPoints: (points: number) => void;

  // Persistent Orchestrator Chat State
  chatMessages: ChatMessage[];
  chatId: string | null;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  loadChatFromSupabase: () => Promise<void>;
  syncChatToSupabase: () => Promise<void>;
  clearChat: () => void;

  // Learning Goals
  learningGoals: any[];
  activeGoalId: string | null;
  setActiveGoalId: (id: string | null) => void;
  loadLearningGoals: () => Promise<void>;
  createLearningGoal: (title: string, details?: { deadline: string; currentLevel: string; timeAvailable: number; preferredLearningStyle: string }) => Promise<any>;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isCommandBarOpen: false,
      setCommandBarOpen: (open) => set({ isCommandBarOpen: open }),
      toggleCommandBar: () => set((state) => ({ isCommandBarOpen: !state.isCommandBarOpen })),
      
      isAssistantOpen: false,
      setAssistantOpen: (open) => set({ isAssistantOpen: open }),
      toggleAssistant: () => set((state) => ({ isAssistantOpen: !state.isAssistantOpen })),
      
      toastQueue: [],
      addToast: (message, type = 'info') => set((state) => ({
        toastQueue: [...state.toastQueue, { id: Math.random().toString(36).substring(7), message, type }]
      })),
      removeToast: (id) => set((state) => ({
        toastQueue: state.toastQueue.filter(toast => toast.id !== id)
      })),

      sessionActive: false,
      sessionStartTime: null,
      startSession: () => {
        if (!get().sessionActive) set({ sessionActive: true, sessionStartTime: Date.now() });
      },
      endSession: () => {
        const start = get().sessionStartTime;
        set({ sessionActive: false, sessionStartTime: null });
        if (!start) return 0;
        return Math.round((Date.now() - start) / 60000);
      },

      isSidebarCollapsed: false,
      setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
      isMobileSidebarOpen: false,
      setMobileSidebarOpen: (open) => set({ isMobileSidebarOpen: open }),
      toggleMobileSidebar: () => set((state) => ({ isMobileSidebarOpen: !state.isMobileSidebarOpen })),

      // Real-time Dashboard Telemetry implementation
      currentActiveTask: null,
      setCurrentActiveTask: (task) => set({ currentActiveTask: task }),
      activeTasksList: [],
      setActiveTasksList: (tasks) => set({ activeTasksList: tasks }),
      emotionalState: 'neutral',
      setEmotionalState: (state) => set({ emotionalState: state }),
      atlasMastery: 0,
      setAtlasMastery: (mastery) => set({ atlasMastery: mastery }),
      memoryDueCount: 0,
      setMemoryDueCount: (count) => set({ memoryDueCount: count }),
      autopsyLossPoints: 0,
      setAutopsyLossPoints: (points) => set({ autopsyLossPoints: points }),

      // Persistent Orchestrator Chat State
      chatMessages: [
        { role: 'assistant', content: 'I am here. What do you need?', timestamp: new Date().toISOString() }
      ],
      chatId: null,

      setChatMessages: (messages) => set({ chatMessages: messages }),
      addChatMessage: (message) => {
        set((state) => ({
          chatMessages: [...state.chatMessages, message]
        }));
        get().syncChatToSupabase();
      },

      loadChatFromSupabase: async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from('orchestrator_chats')
            .select('*')
            .eq('user_id', user.id)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
            if (error.code === 'PGRST205') {
              console.warn('orchestrator_chats table not found. Please run the database migrations in the Supabase SQL Editor.');
            } else {
              console.error('Error loading chat from Supabase:', error.message || error, 'Details:', error.details, 'Code:', error.code);
            }
            return;
          }

          if (data) {
            set({
              chatId: data.id,
              chatMessages: data.messages && data.messages.length > 0
                ? data.messages
                : [{ role: 'assistant', content: 'I am here. What do you need?', timestamp: new Date().toISOString() }],
            });
          } else {
            const { data: newChat, error: createError } = await supabase
              .from('orchestrator_chats')
              .upsert({
                user_id: user.id,
                messages: [{ role: 'assistant', content: 'I am here. What do you need?', timestamp: new Date().toISOString() }]
              }, {
                onConflict: 'user_id'
              })
              .select()
              .single();

            if (createError) {
              if (createError.code === 'PGRST205') {
                console.warn('orchestrator_chats table not found. Please run the database migrations in the Supabase SQL Editor.');
              } else {
                console.error('Error creating chat in Supabase:', createError.message || createError, 'Details:', createError.details, 'Code:', createError.code);
              }
            } else if (newChat) {
              set({
                chatId: newChat.id,
                chatMessages: newChat.messages,
              });
            }
          }
        } catch (err) {
          console.error('Failed to load chat:', err);
        }
      },

      syncChatToSupabase: async () => {
        try {
          const { chatId, chatMessages } = get();
          if (!chatId) return;

          const supabase = createClient();
          const { error } = await supabase
            .from('orchestrator_chats')
            .update({
              messages: chatMessages,
              updated_at: new Date().toISOString(),
            })
            .eq('id', chatId);

          if (error) {
            if (error.code === 'PGRST205') {
              console.warn('orchestrator_chats table not found. Please run the database migrations in the Supabase SQL Editor.');
            } else {
              console.error('Error syncing chat to Supabase:', error.message || error, 'Details:', error.details, 'Code:', error.code);
            }
          }
        } catch (err) {
          console.error('Failed to sync chat:', err);
        }
      },

      clearChat: () => {
        const initialMsg: ChatMessage = {
          role: 'assistant',
          content: 'I am here. What do you need?',
          timestamp: new Date().toISOString(),
        };
        set({ chatMessages: [initialMsg] });
        get().syncChatToSupabase();
      },

      // Learning Goals implementation
      learningGoals: [],
      activeGoalId: null,
      setActiveGoalId: (id) => set({ activeGoalId: id }),
      loadLearningGoals: async () => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data, error } = await supabase
            .from('learning_goals')
            .select('*')
            .order('created_at', { ascending: false });
          if (!error && data) {
            set({ learningGoals: data });
            if (data.length > 0 && !get().activeGoalId) {
              set({ activeGoalId: data[0].id });
            }
          }
        } catch (err) {
          console.error('Failed to load learning goals:', err);
        }
      },
      createLearningGoal: async (title, details) => {
        try {
          const supabase = createClient();
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;

          let goalData = null;
          if (details) {
            const res = await fetch('/api/goals', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                title,
                deadline: details.deadline,
                currentLevel: details.currentLevel,
                timeAvailable: details.timeAvailable,
                preferredLearningStyle: details.preferredLearningStyle,
              }),
            });
            const apiRes = await res.json();
            if (apiRes.success && apiRes.goalId) {
              const { data } = await supabase
                .from('learning_goals')
                .select('*')
                .eq('id', apiRes.goalId)
                .single();
              goalData = data;
            }
          } else {
            const { data, error } = await supabase
              .from('learning_goals')
              .insert({ user_id: user.id, title, status: 'active' })
              .select()
              .single();
            if (!error && data) {
              goalData = data;
            }
          }

          if (goalData) {
            set((state) => ({
              learningGoals: [goalData, ...state.learningGoals],
              activeGoalId: goalData.id,
            }));
            return goalData;
          }
        } catch (err) {
          console.error('Failed to create learning goal:', err);
        }
        return null;
      },
    }),
    {
      name: 'cognition-os-store',
      partialize: (state) => ({
        chatMessages: state.chatMessages,
        chatId: state.chatId,
        isSidebarCollapsed: state.isSidebarCollapsed,
        activeGoalId: state.activeGoalId,
      }),
    }
  )
);

