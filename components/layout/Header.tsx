'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { BookOpenCheck, Menu, MessageCircle, Upload } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

interface HeaderProps {
  userName: string;
  streakDays: number;
}

export default function Header({ userName, streakDays }: HeaderProps) {
  const { toggleMobileSidebar } = useAppStore();
  const firstName = userName?.split(' ')?.[0] || 'Student';

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', minWidth: 0 }}>
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
          aria-label="Open navigation"
        >
          <Menu size={20} />
        </button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', fontWeight: 700 }}>
            Study Workspace
          </div>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 900, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {firstName}'s Cognition
          </div>
        </div>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <HeaderLink href="/materials">
          <Upload size={15} />
          <span>Upload</span>
        </HeaderLink>
        <HeaderLink href="/study-room">
          <MessageCircle size={15} />
          <span>Study Room</span>
        </HeaderLink>
        <HeaderLink href="/review">
          <BookOpenCheck size={15} />
          <span>{streakDays > 0 ? `${streakDays} day streak` : 'Review'}</span>
        </HeaderLink>
      </div>
    </header>
  );
}

function HeaderLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        minHeight: 34,
        padding: '0 var(--sp-3)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
        color: 'var(--text-secondary)',
        textDecoration: 'none',
        fontSize: 'var(--fs-sm)',
        fontWeight: 800,
      }}
    >
      {children}
    </Link>
  );
}
