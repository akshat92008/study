'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare, Zap, X, ChevronLeft, ChevronRight, LogOut,
  Brain, RefreshCw, Activity, Home
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { signOut } from '@/lib/actions/auth';

interface SidebarProps {
  userName: string;
  examType: string;
}

export default function Sidebar({ userName, examType }: SidebarProps) {
  const pathname = usePathname();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
  } = useAppStore();
  const navItems = [
    { label: 'Today', href: '/dashboard', icon: Home },
    { label: 'MIND', href: '/chat', icon: MessageSquare },
    { label: 'Test Analysis', href: '/autopsy', icon: Activity },
    { label: 'Progress', href: '/cognition', icon: Brain },
    { label: 'Revision Due', href: '/revision', icon: RefreshCw },
  ];

  useEffect(() => {
    // Goals removed for MVP
  }, []);


  return (
    <aside
      id="sidebar"
      className={`sidebar-aside ${isMobileSidebarOpen ? 'mobile-open' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
      style={{
        zIndex: 100,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: 'var(--sp-5) var(--sp-5)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-3)',
          justifyContent: 'space-between',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-md)',
              background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Zap size={18} color="white" />
          </div>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              opacity: isSidebarCollapsed ? 0 : 1,
              transition: 'opacity var(--duration-fast) var(--ease-out)',
            }}
          >
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
              Cognition <span style={{ color: 'var(--accent-blue)' }}>OS</span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)' }}>
              {examType} Mission Loop
            </div>
          </div>
        </div>

        {/* Close Button on Mobile */}
        <button
          onClick={() => setMobileSidebarOpen(false)}
          className="mobile-only"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px',
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Navigation */}
      <nav
        style={{
          flex: 1,
          padding: 'var(--sp-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
          overflowY: 'auto',
          overflowX: 'hidden',
        }}
      >
        {/* Workspace Links */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
          {!isSidebarCollapsed && (
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', padding: '0 var(--sp-3)', marginBottom: 4 }}>
              Core Loop
            </span>
          )}
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href === '/dashboard' && pathname === '/');
            return (
              <Link
                key={item.href}
                href={item.href}
                title={item.label}
                onClick={() => setMobileSidebarOpen(false)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: isSidebarCollapsed ? 0 : 'var(--sp-3)',
                  justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: 'var(--fs-sm)',
                  fontWeight: isActive ? 'var(--fw-bold)' : 'var(--fw-medium)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--bg-secondary)' : 'transparent',
                  textDecoration: 'none',
                  position: 'relative',
                }}
              >
                {isActive && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: '25%',
                      bottom: '25%',
                      width: 3,
                      background: 'var(--accent-blue)',
                      borderRadius: 2,
                    }}
                  />
                )}
                <Icon size={16} style={{ color: isActive ? 'var(--accent-blue)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                {!isSidebarCollapsed && <span>{item.label}</span>}
              </Link>
            );
          })}
        </div>

        {/* Learning Goals Section removed for MVP */}

      </nav>

      {/* Collapse Toggle Button (Desktop-only) */}
      <div
        className="desktop-only"
        style={{
          display: 'flex',
          justifyContent: isSidebarCollapsed ? 'center' : 'flex-end',
          padding: 'var(--sp-2) var(--sp-4)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={toggleSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: 'var(--sp-2)',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title={isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isSidebarCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* User profile section */}
      <div
        style={{
          padding: isSidebarCollapsed ? 'var(--sp-4) var(--sp-2)' : 'var(--sp-4) var(--sp-5)',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          flexDirection: isSidebarCollapsed ? 'column' : 'row',
          alignItems: 'center',
          gap: isSidebarCollapsed ? 'var(--sp-2)' : 'var(--sp-3)',
          justifyContent: 'space-between',
          transition: 'all var(--duration-normal) var(--ease-out)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 0, flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 'var(--radius-full)',
              background: 'var(--accent-blue-dim)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 'var(--fs-sm)',
              fontWeight: 'var(--fw-bold)',
              color: 'var(--accent-blue)',
              flexShrink: 0,
            }}
          >
            {userName.charAt(0).toUpperCase()}
          </div>
          {!isSidebarCollapsed && (
            <div
              style={{
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                minWidth: 0,
                flex: 1,
              }}
            >
              <div
                style={{
                  fontSize: 'var(--fs-sm)',
                  fontWeight: 'var(--fw-medium)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  color: 'var(--text-primary)',
                }}
              >
                {userName}
              </div>
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Free Plan</div>
            </div>
          )}
        </div>

        {/* Log Out Button */}
        <button
          onClick={() => signOut()}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}
          title="Log Out"
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.background = 'var(--bg-secondary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-secondary)';
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <LogOut size={16} />
        </button>
      </div>

      {/* Goal Ingestion Modal removed for MVP */}

    </aside>
  );
}
