'use client';

import { Flame, Search, Bell, Menu } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface HeaderProps {
  userName: string;
  streakDays: number;
}

export default function Header({ userName, streakDays }: HeaderProps) {
  const { toggleMobileSidebar, activeTasksList } = useAppStore();

  const isAtRisk = streakDays > 0 && activeTasksList.length > 0 && !activeTasksList.some(t => t.is_completed);

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
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes warning-pulse {
          0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.45); }
          70% { box-shadow: 0 0 0 8px rgba(245, 158, 11, 0); }
          100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
        }
        @keyframes flame-flicker {
          0%, 100% { transform: scale(1); opacity: 1; filter: drop-shadow(0 0 2px rgba(245, 158, 11, 0.2)); }
          50% { transform: scale(1.1) rotate(-5deg); opacity: 0.9; filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.6)); }
        }
        .warning-pulse-anim {
          animation: warning-pulse 2s infinite;
        }
        .flame-flicker-anim {
          animation: flame-flicker 1.5s infinite ease-in-out;
        }
      `}} />

      {/* Menu & Branding */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginRight: 'var(--sp-4)' }}>
        <button
          onClick={toggleMobileSidebar}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '6px',
            borderRadius: 'var(--radius-sm)',
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          <Menu size={20} />
        </button>
        <span style={{ fontWeight: 800, fontSize: 'var(--fs-sm)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            width: 18, height: 18, borderRadius: 4,
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <span style={{ fontSize: 9, color: 'white', fontWeight: 900 }}>C</span>
          </span>
          Cognition OS
        </span>
      </div>

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
        
        {/* ========================================================================= */}
        {/* TASK 3.2: PROMINENT STREAK COUNTER (With warning pulse for risk states)     */}
        {/* ========================================================================= */}
        <div
          title={`${streakDays} Day Habit Streak${isAtRisk ? ' (At Risk - Complete today\'s focus session!)' : ''}`}
          className={isAtRisk ? 'warning-pulse-anim' : ''}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-1)',
            padding: 'var(--sp-1) var(--sp-3)',
            background: streakDays > 0 ? 'var(--warning-glow)' : 'var(--bg-tertiary)',
            border: `1px solid ${streakDays > 0 ? (isAtRisk ? 'var(--warning)' : 'var(--warning-dim)') : 'var(--border-default)'}`,
            borderRadius: 'var(--radius-full)',
            boxShadow: streakDays > 0 ? '0 0 10px hsla(38, 92%, 50%, 0.15)' : 'none',
            transition: 'all 0.3s ease',
          }}
        >
          <div className={isAtRisk ? 'flame-flicker-anim' : ''} style={{ display: 'flex', alignItems: 'center' }}>
            <Flame 
              size={14} 
              style={{ color: streakDays > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} 
              fill={streakDays > 0 ? 'var(--warning)' : 'none'}
            />
          </div>
          <span
            style={{
              fontSize: 'var(--fs-sm)', // Scaled up slightly for prominence
              fontWeight: 'var(--fw-black)',
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
