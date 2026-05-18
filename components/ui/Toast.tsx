'use client';

import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export default function ToastContainer() {
  const { toastQueue, removeToast } = useAppStore();

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toastQueue.map((toast: any) => (
          <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: any; onRemove: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onRemove();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onRemove]);

  const icons = {
    success: <CheckCircle className="text-green-400" size={18} />,
    error: <AlertCircle className="text-red-400" size={18} />,
    info: <Info className="text-blue-400" size={18} />
  };

  const bgs = {
    success: 'bg-green-950/50 border-green-900',
    error: 'bg-red-950/50 border-red-900',
    info: 'bg-blue-950/50 border-blue-900'
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      className={`flex items-start gap-3 rounded-lg border p-3 shadow-lg backdrop-blur-md ${bgs[toast.type as keyof typeof bgs]}`}
    >
      <div className="mt-0.5">{icons[toast.type as keyof typeof icons]}</div>
      <div className="flex-1 text-sm font-medium text-zinc-100">{toast.message}</div>
      <button onClick={onRemove} className="text-zinc-500 hover:text-zinc-300">
        <X size={16} />
      </button>
    </motion.div>
  );
}
