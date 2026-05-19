'use client';

import { Flame, Search, Bell, Menu } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface HeaderProps {
  userName: string;
  streakDays: number;
}

export default function Header({ userName, streakDays }: HeaderProps) {
  const { toggleMobileSidebar } = useAppStore();

  return (
    <header
      id="header"
      style={{
        position: 'fixed',
        top: 0,
        right: 0,
        left: 'var(--sidebar-width)',
        height: 'var(--header-height)',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 var(--sp-6)',
        zIndex: 50,
        transition: 'left var(--duration-normal) var(--ease-out)',
      }}
    >
      {/* Mobile hamburger menu */}
      <button
        className="mobile-only"
        onClick={toggleMobileSidebar}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          cursor: 'pointer',
          marginRight: 'var(--sp-3)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Menu size={20} />
      </button>

      {/* Search */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          padding: 'var(--sp-2) var(--sp-3)',
          maxWidth: 400,
          cursor: 'pointer',
        }}
      >
        <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          Search concepts, chapters...
        </span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: 'var(--fs-xs)',
            color: 'var(--text-tertiary)',
            fontFamily: 'var(--font-mono)',
            background: 'var(--bg-tertiary)',
            padding: '1px 6px',
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--border-default)',
          }}
        >
          ⌘K
        </span>
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginLeft: 'auto' }}>
        {/* Streak */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-1)',
            padding: 'var(--sp-1) var(--sp-3)',
            background: streakDays > 0 ? 'var(--warning-glow)' : 'var(--bg-tertiary)',
            border: `1px solid ${streakDays > 0 ? 'var(--warning-dim)' : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-full)',
          }}
        >
          <Flame size={14} style={{ color: streakDays > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} />
          <span
            style={{
              fontSize: 'var(--fs-xs)',
              fontWeight: 'var(--fw-bold)',
              fontFamily: 'var(--font-mono)',
              color: streakDays > 0 ? 'var(--warning)' : 'var(--text-tertiary)',
            }}
          >
            {streakDays}
          </span>
        </div>

        {/* Notifications */}
        <button
          style={{
            width: 34,
            height: 34,
            borderRadius: 'var(--radius-md)',
            background: 'transparent',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
          }}
        >
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
