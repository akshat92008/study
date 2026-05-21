'use client';

import React from 'react';
import { useAppStore } from '@/stores/appStore';
import Sidebar from './Sidebar';
import Header from './Header';

import GlobalChat from '../chat/GlobalChat';

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  profile: any;
}

export default function DashboardClientLayout({ children, profile }: DashboardClientLayoutProps) {
  const { isSidebarCollapsed, isMobileSidebarOpen, setMobileSidebarOpen } = useAppStore();

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
      {/* Mobile Drawer Overlay Backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={() => setMobileSidebarOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(5, 7, 12, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 98,
            transition: 'opacity var(--duration-normal) var(--ease-out)',
          }}
        />
      )}

      {/* Sidebar Navigation */}
      <Sidebar
        userName={profile?.full_name || 'Student'}
        examType={profile?.exam_type || 'General'}
      />

      {/* Content wrapper */}
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
          <main
            style={{
              flex: 1,
              padding: 'var(--sp-6)',
              overflowY: 'auto',
              maxWidth: 'var(--content-max-width)',
              width: '100%',
              minWidth: 0,
            }}
          >
            {children}
          </main>
          <GlobalChat />
        </div>
      </div>
    </div>
  );
}
