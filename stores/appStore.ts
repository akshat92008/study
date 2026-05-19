import { create } from 'zustand';

interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
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
}

export const useAppStore = create<AppState>((set, get) => ({
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
  }
}));
