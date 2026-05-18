'use client';

import { useAppStore } from '@/stores/appStore';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Modal from './Modal';
import { Search, Compass, Book, Target } from 'lucide-react';

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
    { name: 'Dashboard', icon: Compass, route: '/dashboard' },
    { name: 'Cognition Graph', icon: Search, route: '/dashboard/cognition' },
    { name: 'Knowledge Base', icon: Book, route: '/dashboard/knowledge' },
    { name: 'Mistake Intelligence', icon: Target, route: '/dashboard/mistakes' }
  ];

  const filtered = actions.filter(a => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <Modal isOpen={isCommandBarOpen} onClose={() => setCommandBarOpen(false)} title="Command Center">
      <div className="flex flex-col gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={18} />
          <input 
            type="text" 
            placeholder="Search commands or jump to..." 
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg py-2 pl-10 pr-4 text-zinc-100 focus:outline-none focus:border-cyan-500"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          {filtered.map((action, idx) => (
            <button
              key={idx}
              className="flex items-center gap-3 w-full p-2 rounded hover:bg-zinc-800 text-left transition-colors"
              onClick={() => {
                router.push(action.route);
                setCommandBarOpen(false);
              }}
            >
              <action.icon size={16} className="text-zinc-400" />
              <span className="text-sm font-medium text-zinc-200">{action.name}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-zinc-500 text-sm text-center py-4">No results found.</p>}
        </div>
      </div>
    </Modal>
  );
}
