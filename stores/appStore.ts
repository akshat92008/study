import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  subject?: string | null;
  domain?: string | null;
  exam_type?: string | null;
  preset_id?: string | null;
  target_level?: string | null;
  description?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  target_date?: string | null;
  deadline?: string | null;
  current_level?: string | null;
  time_available?: string | null;
  preferred_learning_style?: string | null;
  confidence_score?: number | null;
  progress?: number | null;
  primary_chat_session_id?: string | null;
  last_active_at?: string | null;
  metadata?: Record<string, any> | null;
  counts?: {
    sourcesReady?: number;
    sourcesProcessing?: number;
    dueCards?: number;
    weakConcepts?: number;
    recentMistakes?: number;
    microtasksPending?: number;
  };
}

interface CreateLearningGoalDetails {
  subject?: string;
  domain?: string;
  examType?: string;
  presetId?: string;
  targetLevel?: string;
  description?: string;
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
  activeGoalContext: any | null;
  selectedMaterialIds: string[];
  setSelectedMaterialIds: (ids: string[]) => void;
  toggleSelectedMaterial: (id: string) => void;
  clearSelectedMaterials: () => void;
  setActiveGoalId: (id: string | null) => void;
  loadLearningGoals: () => Promise<void>;
  loadGoalContext: (goalId?: string | null) => Promise<any | null>;
  selectLearningGoal: (goalId: string | null) => Promise<void>;
  ensureGoalSession: (goalId: string) => Promise<string | null>;
  loadGoalLinkedSession: (goalId: string) => Promise<void>;
  loadDashboardForActiveGoal: () => void;
  createLearningGoal: (title: string, details?: CreateLearningGoalDetails) => Promise<LearningGoal | null>;
  createGoalWithSession: (title: string, details?: CreateLearningGoalDetails) => Promise<LearningGoal | null>;
  updateLearningGoal: (goalId: string, updates: Partial<CreateLearningGoalDetails> & { title?: string }) => Promise<LearningGoal | null>;

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

      isAssistantOpen: false,
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
      activeGoalContext: null,
      selectedMaterialIds: [],
      setSelectedMaterialIds: (ids) => set({ selectedMaterialIds: Array.from(new Set(ids)) }),
      toggleSelectedMaterial: (id) => set((state) => ({
        selectedMaterialIds: state.selectedMaterialIds.includes(id)
          ? state.selectedMaterialIds.filter(m => m !== id)
          : [...state.selectedMaterialIds, id]
      })),
      clearSelectedMaterials: () => set({ selectedMaterialIds: [] }),
      setActiveGoalId: (id) => set({ activeGoalId: id, selectedMaterialIds: [] }),
      
      loadLearningGoals: async () => {
        try {
          const response = await fetch('/api/goals', { method: 'GET' });
          if (!response.ok) return;
          const data = await response.json();
          const goals = Array.isArray(data.goals) ? data.goals as LearningGoal[] : [];
          set({ learningGoals: goals });
          const currentId = get().activeGoalId;
          const currentStillExists = currentId && goals.some(goal => goal.id === currentId);
          
          // Only auto-select first goal if current goal is definitively missing AND we have goals available
          if (currentId && !currentStillExists && goals.length > 0) {
            await get().selectLearningGoal(goals[0].id);
          } else if (!currentId && goals.length > 0) {
            // Or if no goal was ever selected
            await get().selectLearningGoal(goals[0].id);
          } else if (currentId && !currentStillExists && goals.length === 0) {
            // Preserve the cached ID until the server explicitly resolves the active goal.
            set({ activeGoalContext: null });
          }
        } catch (err) {
          console.error('Failed to load learning goals:', err);
        }
      },

      loadGoalContext: async (goalId) => {
        const id = goalId ?? get().activeGoalId;
        if (!id) {
          set({ activeGoalContext: null });
          return null;
        }
        try {
          const response = await fetch(`/api/goals/${id}/context`, { method: 'GET' });
          if (!response.ok) return null;
          const context = await response.json();
          set({ activeGoalContext: context });
          if (context.goal) {
            set((state) => ({
              learningGoals: state.learningGoals.map(goal =>
                goal.id === context.goal.id
                  ? { ...goal, ...context.goal, counts: context.counts }
                  : goal
              ),
            }));
          }
          return context;
        } catch (err) {
          console.error('Failed to load goal context:', err);
          return null;
        }
      },

      ensureGoalSession: async (goalId) => {
        try {
          const response = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ goalId, sessionType: 'goal' }),
          });
          if (!response.ok) return null;
          const data = await response.json();
          if (data.session?.id) {
            await get().loadSessions();
            return data.session.id as string;
          }
        } catch (err) {
          console.error('Failed to ensure goal session:', err);
        }
        return null;
      },

      loadGoalLinkedSession: async (goalId) => {
        const goal = get().learningGoals.find(g => g.id === goalId);
        const sessionId = goal?.primary_chat_session_id || await get().ensureGoalSession(goalId);
        if (sessionId) {
          await get().selectSession(sessionId);
        } else {
          await get().loadChatFromSupabase(undefined);
        }
      },

      selectLearningGoal: async (goalId) => {
        set({ activeGoalId: goalId });
        if (!goalId) {
          set({ activeGoalContext: null });
          await get().loadChatFromSupabase(undefined);
          get().loadDashboardForActiveGoal();
          return;
        }

        await get().loadGoalContext(goalId);
        await get().loadGoalLinkedSession(goalId);
        get().loadDashboardForActiveGoal();
      },

      loadDashboardForActiveGoal: () => {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('refresh-dashboard'));
          window.dispatchEvent(new Event('refresh-goal-context'));
        }
      },
      createLearningGoal: async (title, details) => {
        return get().createGoalWithSession(title, details);
      },

      createGoalWithSession: async (title, details) => {
        const cleanTitle = typeof title === 'string' ? title.trim() : '';
        if (!cleanTitle) {
          get().addToast('Please enter a specific learning goal first.', 'error');
          return null;
        }

        try {
          const res = await fetch('/api/goals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              title: cleanTitle,
              subject: details?.subject ?? null,
              domain: details?.domain ?? null,
              examType: details?.examType ?? details?.targetLevel ?? null,
              presetId: details?.presetId ?? null,
              targetLevel: details?.targetLevel ?? null,
              description: details?.description ?? null,
              deadline: details?.deadline ?? null,
              currentLevel: details?.currentLevel ?? null,
              timeAvailable: details?.timeAvailable ?? null,
              preferredLearningStyle: details?.preferredLearningStyle ?? null,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            let message = `Failed to create goal: ${res.status}`;
            try {
              const parsed = JSON.parse(errText);
              message = parsed?.message || parsed?.error || message;
            } catch {
              message = errText || message;
            }
            get().addToast(message, 'error');
            return null;
          }
          const apiRes = await res.json();
          const goalData = apiRes.goal as LearningGoal | null;

          if (goalData) {
            set((state) => ({
              learningGoals: [goalData, ...state.learningGoals.filter(goal => goal.id !== goalData.id)],
              activeGoalId: goalData.id,
            }));
            if (apiRes.session?.id) {
              await get().loadSessions();
              await get().selectSession(apiRes.session.id);
            }
            await get().loadGoalContext(goalData.id);
            get().loadDashboardForActiveGoal();
            return goalData;
          }
        } catch (err: any) {
          console.error('Failed to create learning goal:', err);
          get().addToast(`Failed to create goal: ${err.message}`, 'error');
        }
        return null;
      },

      updateLearningGoal: async (goalId, updates) => {
        try {
          const res = await fetch(`/api/goals/${goalId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates),
          });
          if (!res.ok) {
            const errText = await res.text();
            console.error('Failed to update learning goal (API):', res.status, errText);
            get().addToast(`Failed to update goal: ${res.status} ${errText}`, 'error');
            return null;
          }
          const apiRes = await res.json();
          const goalData = apiRes.goal as LearningGoal | null;

          if (goalData) {
            set((state) => ({
              learningGoals: state.learningGoals.map(g => g.id === goalData.id ? { ...g, ...goalData } : g),
            }));
            if (get().activeGoalId === goalData.id) {
              await get().loadGoalContext(goalData.id);
              get().loadDashboardForActiveGoal();
            }
            get().addToast('Goal updated successfully', 'success');
            return goalData;
          }
        } catch (err: any) {
          console.error('Failed to update learning goal:', err);
          get().addToast(`Failed to update goal: ${err.message}`, 'error');
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
