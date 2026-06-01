// components/ChatShell.tsx
'use client';

import React, { useEffect, useState } from 'react';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/stores/appStore';
import { MessageSquarePlus, MessageSquare, Edit2, Trash2 } from 'lucide-react';

export default function ChatShell() {
  const router = useRouter();
  const { sessions, loadSessions, createNewSession, selectSession, chatId, deleteSession, renameSession } = useAppStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const handleToday = () => {
    router.push('/dashboard');
  };

  const handleRename = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      renameSession(id, editTitle);
      setEditingId(null);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-root)',
      }}
    >
      <header
        style={{
          height: '56px',
          padding: '0 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(255,255,255,0.12)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
          MIND
        </div>
        <button
          onClick={handleToday}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px 8px',
          }}
        >
          Today
        </button>
      </header>

      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <aside style={{
          width: '260px',
          background: 'var(--bg-elevated)',
          borderRight: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px'
        }}>
          <button 
            onClick={() => createNewSession()}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '10px 14px', background: 'var(--accent-purple)',
              color: 'white', border: 'none', borderRadius: '8px',
              cursor: 'pointer', fontWeight: 500, marginBottom: '20px'
            }}
          >
            <MessageSquarePlus size={18} />
            New Chat
          </button>
          
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-tertiary)', padding: '0 8px', marginBottom: '8px' }}>
              Recent Chats
            </div>
            {sessions.map((s: any) => (
              <div 
                key={s.id}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px',
                  borderRadius: '8px',
                  background: chatId === s.id ? 'rgba(124, 102, 255, 0.1)' : 'transparent',
                  color: chatId === s.id ? 'var(--text-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  if (editingId !== s.id) selectSession(s.id);
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  <MessageSquare size={16} color={chatId === s.id ? 'var(--accent-purple)' : 'var(--text-tertiary)'} />
                  {editingId === s.id ? (
                    <input 
                      autoFocus
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                      onKeyDown={e => handleRename(e, s.id)}
                      onBlur={() => setEditingId(null)}
                      style={{ background: 'transparent', border: 'none', outline: 'none', color: 'inherit', width: '100%', fontSize: '14px' }}
                    />
                  ) : (
                    <span style={{ fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.title}
                    </span>
                  )}
                </div>
                {chatId === s.id && editingId !== s.id && !s.is_global && (
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setEditTitle(s.title); setEditingId(s.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                      <Edit2 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)' }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </aside>

        <main style={{ flex: 1, overflow: 'hidden' }}>
          <GlobalChat />
        </main>
      </div>
    </div>
  );
}
