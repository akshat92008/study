// components/ChatShell.tsx
'use client';

import React from 'react';
import { GlobalChat } from '@/components/chat/GlobalChat';
import { useRouter } from 'next/navigation';

/**
 * ChatShell – a full‑screen wrapper for the Cognition OS chat UI.
 * It provides a clean glass‑morphism background, a header bar with the app logo
 * and a quick‑access button to the dashboard (if needed). The component is
 * responsive: on mobile it occupies the entire viewport; on larger screens it
 * keeps a maximum width to avoid stretching the chat too far.
 */
export default function ChatShell() {
  const router = useRouter();

  const handleDashboard = () => {
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
          Cognition OS
        </div>
        <button
          onClick={handleDashboard}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-tertiary)',
            cursor: 'pointer',
            fontSize: '14px',
            padding: '4px 8px',
          }}
        >
          Dashboard
        </button>
      </header>

      {/* Chat area – flex grows to fill remaining space */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <GlobalChat />
      </main>
    </div>
  );
}
