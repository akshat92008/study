# MODULE 4: Dashboard Shell (Layout, Sidebar, Header)

## PROMPT FOR AI BUILDER

```
You are building the main dashboard shell for Cognition OS.
This includes: Sidebar navigation, Header bar, and the dashboard layout.
The aesthetic is Bloomberg Terminal + F1 telemetry — dark, premium, data-dense.
Use vanilla CSS with CSS variables from globals.css. NO Tailwind. Use lucide-react for icons.
All components use inline styles referencing CSS variables (e.g., var(--bg-secondary)).
```

---

## STEP 1: Dashboard Layout — `app/(dashboard)/layout.tsx`

```tsx
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  return (
    <div style={{
      display: 'flex', minHeight: '100vh', background: 'var(--bg-root)',
    }}>
      <Sidebar userName={profile?.full_name || 'Student'} examType={profile?.exam_type || 'NEET'} />
      <div style={{ flex: 1, marginLeft: 'var(--sidebar-width)', display: 'flex', flexDirection: 'column' }}>
        <Header userName={profile?.full_name || 'Student'} streakDays={profile?.streak_days || 0} />
        <main style={{
          flex: 1, padding: 'var(--sp-6)',
          marginTop: 'var(--header-height)',
          maxWidth: 'var(--content-max-width)',
          width: '100%',
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
```

---

## STEP 2: Sidebar — `components/layout/Sidebar.tsx`

```tsx
'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  Brain, Target, RefreshCw, MessageCircle, Calendar,
  GraduationCap, BarChart3, LayoutDashboard, Zap,
} from 'lucide-react';

interface SidebarProps {
  userName: string;
  examType: string;
}

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Command Center', shortcut: '⌘1' },
  { href: '/dashboard/cognition', icon: Brain, label: 'Cognition Graph', shortcut: '⌘2' },
  { href: '/dashboard/mistakes', icon: Target, label: 'Mistake Intelligence', shortcut: '⌘3' },
  { href: '/dashboard/revision', icon: RefreshCw, label: 'Revision Engine', shortcut: '⌘4' },
  { href: '/dashboard/mentor', icon: MessageCircle, label: 'AI Mentor', shortcut: '⌘5' },
  { href: '/dashboard/planner', icon: Calendar, label: 'Planner', shortcut: '⌘6' },
  { href: '/dashboard/tutor', icon: GraduationCap, label: 'AI Tutor', shortcut: '⌘7' },
  { href: '/dashboard/analytics', icon: BarChart3, label: 'Analytics', shortcut: '⌘8' },
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
```

---

## STEP 3: Header — `components/layout/Header.tsx`

```tsx
'use client';

import { Flame, Search, Bell } from 'lucide-react';

interface HeaderProps {
  userName: string;
  streakDays: number;
}

export default function Header({ userName, streakDays }: HeaderProps) {
  return (
    <header id="header" style={{
      position: 'fixed', top: 0, right: 0,
      left: 'var(--sidebar-width)',
      height: 'var(--header-height)',
      background: 'var(--bg-glass)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex', alignItems: 'center',
      padding: '0 var(--sp-6)',
      zIndex: 50,
    }}>
      {/* Search */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--sp-2)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)', padding: 'var(--sp-2) var(--sp-3)',
        maxWidth: 400, cursor: 'pointer',
      }}>
        <Search size={14} style={{ color: 'var(--text-tertiary)' }} />
        <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          Search concepts, chapters...
        </span>
        <span style={{
          marginLeft: 'auto', fontSize: 'var(--fs-xs)',
          color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)',
          background: 'var(--bg-tertiary)', padding: '1px 6px',
          borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-default)',
        }}>⌘K</span>
      </div>

      {/* Right section */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', marginLeft: 'auto' }}>
        {/* Streak */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 'var(--sp-1)',
          padding: 'var(--sp-1) var(--sp-3)',
          background: streakDays > 0 ? 'var(--warning-glow)' : 'var(--bg-tertiary)',
          border: `1px solid ${streakDays > 0 ? 'var(--warning-dim)' : 'var(--border-default)'}`,
          borderRadius: 'var(--radius-full)',
        }}>
          <Flame size={14} style={{ color: streakDays > 0 ? 'var(--warning)' : 'var(--text-tertiary)' }} />
          <span style={{
            fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)',
            fontFamily: 'var(--font-mono)',
            color: streakDays > 0 ? 'var(--warning)' : 'var(--text-tertiary)',
          }}>
            {streakDays}
          </span>
        </div>

        {/* Notifications */}
        <button style={{
          width: 34, height: 34, borderRadius: 'var(--radius-md)',
          background: 'transparent', border: '1px solid var(--border-subtle)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-secondary)',
        }}>
          <Bell size={16} />
        </button>
      </div>
    </header>
  );
}
```

---

## STEP 4: Dashboard Home Placeholder — `app/(dashboard)/page.tsx`

```tsx
export default function DashboardPage() {
  return (
    <div className="animate-fade">
      <h1 style={{
        fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)',
        letterSpacing: 'var(--ls-tight)', marginBottom: 'var(--sp-2)',
      }}>
        Command Center
      </h1>
      <p style={{ color: 'var(--text-secondary)' }}>
        Your AI-powered academic operating system is initializing...
      </p>
    </div>
  );
}
```

---

## VERIFICATION

```bash
npm run dev
# 1. Sign up / log in
# 2. Should redirect to /dashboard
# 3. Sidebar visible with all nav items, active state highlights current page
# 4. Header with search bar, streak counter, bell icon
# 5. Navigation links work between all pages (they'll show empty content, that's fine)
```

**→ NEXT: MODULE 5 (Cognition Graph)**
