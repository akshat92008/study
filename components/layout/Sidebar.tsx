'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Brain, Target, RefreshCw, MessageCircle, Calendar,
  GraduationCap, BarChart3, LayoutDashboard, Zap, Database, Activity,
} from 'lucide-react';

interface SidebarProps {
  userName: string;
  examType: string;
}

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Command Center', shortcut: '⌘1' },
  { href: '/cognition', icon: Brain, label: 'Cognition Graph', shortcut: '⌘2' },
  { href: '/knowledge', icon: Database, label: 'Knowledge Base', shortcut: '⌘9' },
  { href: '/mistakes', icon: Target, label: 'Mistake Intelligence', shortcut: '⌘3' },
  { href: '/revision', icon: RefreshCw, label: 'Revision Engine', shortcut: '⌘4' },
  { href: '/mentor', icon: MessageCircle, label: 'AI Mentor', shortcut: '⌘5' },
  { href: '/planner', icon: Calendar, label: 'Planner', shortcut: '⌘6' },
  { href: '/tutor', icon: GraduationCap, label: 'AI Tutor', shortcut: '⌘7' },
  { href: '/analytics', icon: BarChart3, label: 'Analytics', shortcut: '⌘8' },
  { href: '/pulse', icon: Activity, label: 'PULSE Center', shortcut: '⌘P' },
];

export default function Sidebar({ userName, examType }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside id="sidebar" style={{
      position: 'fixed', left: 0, top: 0, bottom: 0,
      width: 'var(--sidebar-width)',
      background: 'var(--bg-primary)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex', flexDirection: 'column',
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{
        padding: 'var(--sp-5) var(--sp-5)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-md)',
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Zap size={18} color="white" />
        </div>
        <div>
          <div style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
            Cognition <span style={{ color: 'var(--accent-blue)' }}>OS</span>
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)' }}>
            {examType} Engine
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: 'var(--sp-3)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--fs-sm)',
              fontWeight: isActive ? 'var(--fw-semibold)' as any : 'var(--fw-normal)' as any,
              color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: isActive ? 'var(--bg-tertiary)' : 'transparent',
              textDecoration: 'none',
              transition: 'all var(--duration-fast)',
              position: 'relative',
            }}>
              {isActive && <div style={{
                position: 'absolute', left: 0, top: '25%', bottom: '25%', width: 3,
                background: 'var(--accent-blue)', borderRadius: 2,
              }} />}
              <Icon size={18} style={{ opacity: isActive ? 1 : 0.6 }} />
              <span style={{ flex: 1 }}>{item.label}</span>
              <span style={{
                fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)',
                fontFamily: 'var(--font-mono)', opacity: 0.5,
              }}>{item.shortcut}</span>
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div style={{
        padding: 'var(--sp-4) var(--sp-5)',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', alignItems: 'center', gap: 'var(--sp-3)',
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 'var(--radius-full)',
          background: 'var(--accent-blue-dim)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)', color: 'var(--accent-blue)',
        }}>
          {userName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {userName}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Free Plan</div>
        </div>
      </div>
    </aside>
  );
}
