'use client';

import React, { useState, useEffect } from 'react';
import { useAppStore } from '@/stores/appStore';
import Sidebar from './Sidebar';
import Header from './Header';
import { usePathname, useRouter } from 'next/navigation';
import { GlobalChat } from '../chat/GlobalChat';

interface DashboardClientLayoutProps {
  children: React.ReactNode;
  profile: any;
  serverRedirectUrl?: string | null;
}

export default function DashboardClientLayout({ children, profile, serverRedirectUrl }: DashboardClientLayoutProps) {
  const {
    isSidebarCollapsed,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    isAssistantOpen,
    setAssistantOpen,
    assistantWidth,
    setAssistantWidth,
    isAssistantExpanded,
    setAssistantExpanded,
  } = useAppStore();

  const isOverwhelmed = profile?.emotional_state === 'overwhelmed';
  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Handle server-requested redirects safely to prevent infinite loops
  useEffect(() => {
    if (serverRedirectUrl && pathname !== serverRedirectUrl) {
      router.replace(serverRedirectUrl);
    }
  }, [serverRedirectUrl, pathname, router]);

  // Monitor resize to set mobile flag
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Handle panel drag resizing
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      const minWidth = 320;
      const maxWidth = window.innerWidth * 0.8;
      const constrainedWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
      
      setAssistantWidth(constrainedWidth);
      
      if (isAssistantExpanded) {
        setAssistantExpanded(false);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isAssistantExpanded, setAssistantWidth, setAssistantExpanded]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

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

          {/* Main content area (OS Dashboard / Pages) */}
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
            {children}
          </main>

          {/* Global Chat — collapsible right drawer */}
          {isAssistantOpen ? (
            isMobile ? (
              <div
                style={{
                  position: 'fixed',
                  top: 'var(--header-height)',
                  left: 0,
                  right: 0,
                  bottom: 0,
                  zIndex: 90,
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--bg-elevated)',
                }}
              >
                <GlobalChat />
              </div>
            ) : (
              <div
                style={{
                  width: isAssistantExpanded ? '750px' : `${assistantWidth}px`,
                  maxWidth: '85vw',
                  minWidth: '320px',
                  flexShrink: 0,
                  borderLeft: '1px solid var(--border-default)',
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--bg-elevated)',
                  position: 'relative',
                  transition: isDragging ? 'none' : 'width var(--duration-slow) var(--ease-out)',
                }}
              >
                <div
                  onMouseDown={handleMouseDown}
                  className={`chat-resize-handle ${isDragging ? 'active' : ''}`}
                />
                <GlobalChat />
              </div>
            )
          ) : (
            <button
              onClick={() => setAssistantOpen(true)}
              title="Open Assistant"
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