import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createClient } from '@/lib/supabase/client';
import { createChatSlice, type ChatSlice, type ChatMessage } from './slices/chatSlice';

export type { ChatMessage };

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface LearningGoal {
  id: string;
  title: string;
  user_id?: string;
  status?: string | null;
  created_at?: string | null;
  deadline?: string | null;
  current_level?: string | null;
  time_available?: string | null;
  preferred_learning_style?: string | null;
  confidence_score?: number | null;
}

interface CreateLearningGoalDetails {
  deadline?: string;
  currentLevel?: string;
  timeAvailable?: string | number;
  preferredLearningStyle?: string;
}

export interface AppState extends ChatSlice {
  // Command Bar
  isCommandBarOpen: boolean;
  setCommandBarOpen: (open: boolean) => void;
  toggleCommandBar: () => void;
  
  // Global Assistant (Copilot)
  isAssistantOpen: boolean;
  setAssistantOpen: (open: boolean) => void;
  toggleAssistant: () => void;
  assistantWidth: number;
  setAssistantWidth: (width: number) => void;
  isAssistantExpanded: boolean;
  setAssistantExpanded: (expanded: boolean) => void;
  toggleAssistantExpanded: () => void;
  
  // Toasts
  toastQueue: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // Local session timer
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
  streakDays: number;
  setStreakDays: (streak: number) => void;

  // Learning Goals
  learningGoals: LearningGoal[];
  activeGoalId: string | null;
  setActiveGoalId: (id: string | null) => void;
  loadLearningGoals: () => Promise<void>;
  createLearningGoal: (title: string, details?: CreateLearningGoalDetails) => Promise<LearningGoal | null>;

  // Global drawer / UI states
  activeDrawer: 'cognition' | 'revision' | 'autopsy' | null;
  setActiveDrawer: (drawer: 'cognition' | 'revision' | 'autopsy' | null) => void;
  autopsyResult: any;
  setAutopsyResult: (result: any) => void;
  isUploadingMock: boolean;
  setIsUploadingMock: (uploading: boolean) => void;
  uploadStatus: string;
  setUploadStatus: (status: string) => void;

  // Voice Interaction
  voiceModeEnabled: boolean;
  toggleVoiceMode: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get, api) => ({
      // Mount the chat slice directly into the global state
      ...createChatSlice(
        set as unknown as any,
        get as unknown as any,
        api as unknown as any
      ),
      
      isCommandBarOpen: false,
      setCommandBarOpen: (open) => set({ isCommandBarOpen: open }),
      toggleCommandBar: () => set((state) => ({ isCommandBarOpen: !state.isCommandBarOpen })),
      
      isAssistantOpen: true,
      setAssistantOpen: (open) => set({ isAssistantOpen: open }),
      toggleAssistant: () => set((state) => ({ isAssistantOpen: !state.isAssistantOpen })),
      assistantWidth: 500,
      setAssistantWidth: (width) => set({ assistantWidth: width }),
      isAssistantExpanded: false,
      setAssistantExpanded: (expanded) => set({ isAssistantExpanded: expanded }),
      toggleAssistantExpanded: () => set((state) => ({ isAssistantExpanded: !state.isAssistantExpanded })),
      
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
      streakDays: 0,
      setStreakDays: (streak) => set({ streakDays: streak }),

      activeDrawer: null,
      setActiveDrawer: (drawer) => set({ activeDrawer: drawer }),
      autopsyResult: null,
      setAutopsyResult: (result) => set({ autopsyResult: result }),
      isUploadingMock: false,
      setIsUploadingMock: (uploading) => set({ isUploadingMock: uploading }),
      uploadStatus: '',
      setUploadStatus: (status) => set({ uploadStatus: status }),

      voiceModeEnabled: false,
      toggleVoiceMode: () => set((state) => ({ voiceModeEnabled: !state.voiceModeEnabled })),

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
            set({ learningGoals: data as LearningGoal[] });
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

          let goalData: LearningGoal | null = null;
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
      // Persist UI preferences only. Chat history and live learner telemetry are
      // server-authoritative and must be hydrated from Supabase on each load.
      partialize: (state) => ({
        isSidebarCollapsed: state.isSidebarCollapsed,
        activeGoalId: state.activeGoalId,
        assistantWidth: state.assistantWidth,
        isAssistantExpanded: state.isAssistantExpanded,
        voiceModeEnabled: state.voiceModeEnabled,
      }),
      version: 2,
      migrate: (persistedState: any) => {
        const state = (persistedState ?? {}) as Partial<AppState>;
        return {
          isSidebarCollapsed: state.isSidebarCollapsed,
          activeGoalId: state.activeGoalId,
          assistantWidth: state.assistantWidth,
          isAssistantExpanded: state.isAssistantExpanded,
          voiceModeEnabled: state.voiceModeEnabled,
        };
      },
    }
  )
);
