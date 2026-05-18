import { useState, useEffect } from 'react';

// Custom lightweight Zustand emulator to bypass offline sandbox npm install limits
function create<T>(createState: (set: (updater: any) => void) => T) {
  let state: T;
  const listeners = new Set<(state: T) => void>();
  
  const set = (updater: any) => {
    const nextState = typeof updater === 'function' ? updater(state) : updater;
    state = { ...state, ...nextState };
    listeners.forEach((listener) => listener(state));
  };
  
  state = createState(set);
  
  return () => {
    const [, forceUpdate] = useState(0);
    useEffect(() => {
      const listener = () => forceUpdate((c) => c + 1);
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }, []);
    return state;
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
