'use client';

import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { useEffect } from 'react';

export default function ToastContainer() {
  const { toastQueue, removeToast } = useAppStore();

  return (
    <div style={{
      position: 'fixed', bottom: 'var(--sp-4)', right: 'var(--sp-4)',
      zIndex: 50, display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)'
    }}>
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
    success: <CheckCircle color="var(--success)" size={18} />,
    error: <AlertCircle color="var(--danger)" size={18} />,
    info: <Info color="var(--info)" size={18} />
  };

  const bgs = {
    success: { bg: 'var(--success-glow)', border: 'var(--success-dim)' },
    error: { bg: 'var(--danger-glow)', border: 'var(--danger-dim)' },
    info: { bg: 'var(--info-glow)', border: 'var(--info-dim)' }
  };

  const styleConfig = bgs[toast.type as keyof typeof bgs] || bgs.info;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--sp-3)',
        borderRadius: 'var(--radius-lg)', padding: 'var(--sp-3)',
        boxShadow: 'var(--shadow-lg)', backdropFilter: 'blur(8px)',
        background: styleConfig.bg, border: `1px solid ${styleConfig.border}`,
        width: '100%', maxWidth: '300px'
      }}
    >
      <div style={{ marginTop: '2px' }}>{icons[toast.type as keyof typeof icons] || icons.info}</div>
      <div style={{ flex: 1, fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>
        {toast.message}
      </div>
      <button 
        onClick={onRemove} 
        style={{
          background: 'none', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}
        onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
        onMouseOut={e => e.currentTarget.style.color = 'var(--text-tertiary)'}
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}
