import { useSyncExternalStore } from 'react';

// Hydration-safe, production-grade Zustand emulator using built-in React 18+ features
function create<T>(createState: (set: (updater: any) => void, get: () => T) => T) {
  let state: T;
  const listeners = new Set<() => void>();

  const set = (updater: any) => {
    const nextState = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...nextState };
    listeners.forEach((listener) => listener());
  };

  const get = () => state;

  state = createState(set, get);

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  const getSnapshot = () => state;

  return <U = T>(selector?: (state: T) => U): U => {
    const slice = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    return selector ? selector(slice) : (slice as unknown as U);
  };
}

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
  
  // Toasts
  toastQueue: Toast[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  // Session Telemetry (PULSE)
  sessionActive: boolean;
  sessionStartTime: number | null;
  startSession: () => void;
  endSession: () => number; // Returns duration in minutes
}

export const useAppStore = create<AppState>((set, get) => ({
  isCommandBarOpen: false,
  setCommandBarOpen: (open) => set({ isCommandBarOpen: open }),
  toggleCommandBar: () => set((state: AppState) => ({ isCommandBarOpen: !state.isCommandBarOpen })),
  
  toastQueue: [],
  addToast: (message, type = 'info') => set((state: AppState) => ({
    toastQueue: [...state.toastQueue, { id: Math.random().toString(36).substring(7), message, type }]
  })),
  removeToast: (id) => set((state: AppState) => ({
    toastQueue: state.toastQueue.filter(toast => toast.id !== id)
  })),

  // Session Tracking
  sessionActive: false,
  sessionStartTime: null,
  startSession: () => {
    if (!get().sessionActive) {
      set({ sessionActive: true, sessionStartTime: Date.now() });
    }
  },
  endSession: () => {
    const start = get().sessionStartTime;
    set({ sessionActive: false, sessionStartTime: null });
    if (!start) return 0;
    return Math.round((Date.now() - start) / 60000); // Minutes
  }
}));
