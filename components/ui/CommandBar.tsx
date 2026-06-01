'use client';

import { useAppStore } from '@/stores/appStore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { Search, Home, MessageSquare, Brain, RefreshCw, Activity } from 'lucide-react';

export default function CommandBar() {
  const { isCommandBarOpen, setCommandBarOpen } = useAppStore();
  const [query, setQuery] = useState('');
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setCommandBarOpen(!isCommandBarOpen);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [isCommandBarOpen, setCommandBarOpen]);

  const actions = [
    { name: "Today's Mission", icon: Home, route: '/dashboard' },
    { name: 'MIND', icon: MessageSquare, route: '/chat' },
    { name: 'Test Analysis', icon: Activity, route: '/autopsy' },
    { name: 'Progress', icon: Brain, route: '/cognition' },
    { name: 'Revision Due', icon: RefreshCw, route: '/revision' }
  ];

  const filtered = actions.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Modal isOpen={isCommandBarOpen} onClose={() => setCommandBarOpen(false)} title="Quick Actions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        <div style={{ position: 'relative' }}>
          <div style={{ position: 'absolute', left: 'var(--sp-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center' }}>
            <Search size={18} />
          </div>
          <input 
            type="text" 
            placeholder="Search commands or jump to..." 
            style={{
              width: '100%', background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', padding: 'var(--sp-2) var(--sp-4) var(--sp-2) calc(var(--sp-10))',
              color: 'var(--text-primary)', fontSize: 'var(--fs-base)', outline: 'none', transition: 'border-color 0.2s'
            }}
            onFocus={e => e.target.style.borderColor = 'var(--accent-cyan)'}
            onBlur={e => e.target.style.borderColor = 'var(--border-default)'}
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', maxHeight: '16rem', overflowY: 'auto' }}>
          {filtered.map((action, idx) => (
            <button
              key={idx}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', width: '100%',
                padding: 'var(--sp-2)', borderRadius: 'var(--radius-sm)', background: 'transparent',
                border: 'none', textAlign: 'left', cursor: 'pointer', transition: 'background-color 0.15s'
              }}
              onMouseOver={e => e.currentTarget.style.background = 'var(--bg-hover)'}
              onMouseOut={e => e.currentTarget.style.background = 'transparent'}
              onClick={() => {
                router.push(action.route);
                setCommandBarOpen(false);
              }}
            >
              <action.icon size={16} color="var(--text-tertiary)" />
              <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>{action.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', textAlign: 'center', padding: 'var(--sp-4) 0' }}>No results found.</p>}
        </div>
      </div>
    </Modal>
  );
}
