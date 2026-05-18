import { create } from 'zustand';

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
  toggleCommandBar: () => set((state) => ({ isCommandBarOpen: !state.isCommandBarOpen })),
  
  toastQueue: [],
  addToast: (message, type = 'info') => set((state) => ({
    toastQueue: [...state.toastQueue, { id: Math.random().toString(36).substring(7), message, type }]
  })),
  removeToast: (id) => set((state) => ({
    toastQueue: state.toastQueue.filter(toast => toast.id !== id)
  })),
  
  activeModule: null,
  setActiveModule: (module) => set({ activeModule: module }),
}));
