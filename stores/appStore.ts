import { useSyncExternalStore } from 'react';

// Hydration-safe, production-grade Zustand emulator using built-in React 18+ features
function create<T>(createState: (set: (updater: any) => void) => T) {
  let state: T;
  const listeners = new Set<() => void>();

  const set = (updater: any) => {
    const nextState = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...nextState };
    listeners.forEach((listener) => listener());
  };

  state = createState(set);

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

interface AppState {
  isCommandBarOpen: boolean;
  setCommandBarOpen: (open: boolean) => void;
  toggleCommandBar: () => void;
  
  toastQueue: { id: string; message: string; type: 'success' | 'error' | 'info' }[];
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  removeToast: (id: string) => void;
  
  activeModule: string | null;
  setActiveModule: (module: string | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
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
  
  activeModule: null,
  setActiveModule: (module) => set({ activeModule: module }),
}));
