'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/stores/appStore';
import Sidebar from './Sidebar';
import Header from './Header';
import { GlobalChat } from '../chat/GlobalChat';

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  profile: any;
}

export default function DashboardClientLayout({ children, profile }: DashboardClientLayoutProps) {
  const {
    isSidebarCollapsed,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isAssistantOpen,
    setAssistantOpen,
  } = useAppStore();

  const isOverwhelmed = profile?.emotional_state === 'overwhelmed';

  return (
    <div
      className={`dashboard-layout ${isSidebarCollapsed ? 'sidebar-collapsed' : ''} ${isOverwhelmed ? 'recovery-mode' : ''}`}
      style={{
        display: 'flex',
        minHeight: '100vh',
        background: 'var(--bg-root)',
      } as React.CSSProperties}
    >
      {/* Mobile overlay backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(5, 7, 12, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 98,
            transition: 'opacity var(--duration-normal) var(--ease-out)',
          }}
        />
      )}

      {/* ONE sidebar. The hardcoded 56px stub in layout.tsx is deleted. */}
      <Sidebar
        userName={profile?.full_name || 'Student'}
        examType={profile?.exam_type || 'General'}
      />

      {/* Right side: header + page content + chat panel */}
      <div
        style={{
          flex: 1,
          marginLeft: 'var(--sidebar-width)',
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          transition: 'margin-left var(--duration-normal) var(--ease-out)',
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        <Header
          userName={profile?.full_name || 'Student'}
          streakDays={profile?.streak_days || 0}
        />

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden', marginTop: 'var(--header-height)' }}>

          {/* Main is now GlobalChat */}
          <main
            style={{
              flex: 1,
              overflowY: 'auto',
              minWidth: 0,
              background: 'var(--bg-root)',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <GlobalChat />
          </main>

          {/* OS Dashboard (children) — collapsible right drawer */}
          {isAssistantOpen ? (
            <div
              style={{
                width: '420px',
                flexShrink: 0,
                borderLeft: '1px solid var(--border-default)',
                display: 'flex',
                flexDirection: 'column',
                background: 'var(--bg-elevated)',
                overflowY: 'auto'
              }}
            >
              {children}
            </div>
          ) : (
            <button
              onClick={() => setAssistantOpen(true)}
              title="Open OS Dashboard"
              style={{
                position: 'fixed',
                bottom: '24px',
                right: '24px',
                zIndex: 50,
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'var(--accent-blue)',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                <line x1="3" y1="9" x2="21" y2="9"></line>
                <line x1="9" y1="21" x2="9" y2="9"></line>
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}