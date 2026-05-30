// components/ChatShell.tsx
'use client';

import React from 'react';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { useRouter } from 'next/navigation';

/**
 * ChatShell is the full-screen MIND surface: today's mission plus the persistent
 * mentor that reads the learner state available to Cognition OS.
 */
export default function ChatShell() {
  const router = useRouter();

  const handleToday = () => {
    router.push('/dashboard');
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
      {/* Header */}
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

      {/* Chat area – flex grows to fill remaining space */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <GlobalChat />
      </main>
    </div>
  );
}
