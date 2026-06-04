'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Zap, X, ChevronLeft, ChevronRight, LogOut,
  Brain, RefreshCw, Activity, Home, CreditCard, Database, MessageCircle, Plus, Target, SearchCheck
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { signOut } from '@/lib/actions/auth';
import { isFeatureEnabled } from '@/lib/feature-flags';
import GoalCreationModal from '@/components/modals/GoalCreationModal';

interface SidebarProps {
  userName: string;
  examType: string;
}

export default function Sidebar({ userName, examType }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    isSidebarCollapsed,
    toggleSidebar,
    isMobileSidebarOpen,
    setMobileSidebarOpen,
    learningGoals,
    activeGoalId,
    loadLearningGoals,
    selectLearningGoal,
    sessions,
    loadSessions,
  } = useAppStore();
  const navItems = [
    { label: 'Today', href: '/dashboard', icon: Home },
    { label: 'Sources', href: '/knowledge', icon: Database, feature: 'ENABLE_KNOWLEDGE_UI' as const },
    { label: 'Review', href: '/revision', icon: RefreshCw },
    { label: 'Progress', href: '/cognition', icon: Brain, feature: 'ENABLE_ATLAS_UI' as const },
    { label: 'Mistake Review', href: '/autopsy/deep', icon: Activity, feature: 'ENABLE_AUTOPSY_UI' as const },
  ].filter(item => !item.feature || isFeatureEnabled(item.feature));

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);

  useEffect(() => {
    loadLearningGoals();
    loadSessions();
  }, [loadLearningGoals, loadSessions]);

  const recentChats = sessions
    .filter((session: any) => !session.is_global && !session.is_primary_for_goal)
    .slice(0, 5);

  const handleSelectGoal = async (goalId: string) => {
    await selectLearningGoal(goalId);
    setMobileSidebarOpen(false);
    if (!pathname.startsWith('/dashboard')) {
      router.push('/dashboard');
    }
  };

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
          <div style={{ display: 'flex', flexDirection: 'column', opacity: isSidebarCollapsed ? 0 : 1, transition: 'opacity var(--duration-fast) var(--ease-out)' }}>
            <div style={{ fontSize: 'var(--fs-base)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
              Cognition <span style={{ color: 'var(--accent-blue)' }}>OS</span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-ultra)' }}>
              {learningGoals.find(g => g.id === activeGoalId)?.title || examType} Mission Loop
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
        {/* Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
          {!isSidebarCollapsed && (
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', padding: '0 var(--sp-3)', marginBottom: 4 }}>
              Core Loop
            </span>
          )}
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.label}
                href={item.href}
                className="nav-link-base"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-blue-dim)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                title={isSidebarCollapsed ? item.label : undefined}
                onClick={() => setMobileSidebarOpen(false)}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    left: 0,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: 3,
                    height: 16,
                    background: 'var(--accent-blue)',
                    borderRadius: '0 4px 4px 0',
                  }} />
                )}
                <item.icon
                  size={20}
                  strokeWidth={isActive ? 2.5 : 2}
                  style={{ flexShrink: 0 }}
                />
                {!isSidebarCollapsed && (
                  <span style={{
                    fontSize: 'var(--fs-sm)',
                    fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                    whiteSpace: 'nowrap',
                    opacity: 1,
                    transition: 'opacity 0.2s',
                  }}>
                    {item.label}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Learning Goals */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', marginTop: 'var(--sp-2)' }}>
          {!isSidebarCollapsed && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 var(--sp-3)', marginBottom: 4 }}>
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
                Learning Goals
              </span>
              <button
                onClick={() => setIsGoalModalOpen(true)}
                title="New Goal"
                style={{
                  width: 24,
                  height: 24,
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <Plus size={14} />
              </button>
            </div>
          )}
          {isSidebarCollapsed && (
            <button
              onClick={() => setIsGoalModalOpen(true)}
              title="New Goal"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 'var(--sp-3)',
                borderRadius: 'var(--radius-md)',
                border: 'none',
                background: 'transparent',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
              }}
            >
              <Plus size={18} />
            </button>
          )}
          {learningGoals.length === 0 && !isSidebarCollapsed && (
            <button
              onClick={() => setIsGoalModalOpen(true)}
              style={{
                textAlign: 'left',
                padding: 'var(--sp-3)',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--border-strong)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                fontSize: 'var(--fs-xs)',
              }}
            >
              Create a learning goal
            </button>
          )}
          {learningGoals.map((goal) => {
            const isActive = goal.id === activeGoalId;
            const due = goal.counts?.dueCards ?? 0;
            const sources = goal.counts?.sourcesReady ?? 0;
            return (
              <button
                key={goal.id}
                onClick={() => handleSelectGoal(goal.id)}
                className="nav-link-base"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                  color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                  background: isActive ? 'var(--accent-blue-dim)' : 'transparent',
                  border: 'none',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  width: '100%',
                }}
                title={isSidebarCollapsed ? goal.title : undefined}
              >
                <Target size={16} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                {!isSidebarCollapsed && (
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{
                      display: 'block',
                      fontSize: 'var(--fs-xs)',
                      fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {goal.title}
                    </span>
                    {(due > 0 || sources > 0) && (
                      <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-tertiary)', marginTop: 2 }}>
                        {[sources ? `${sources} sources` : null, due ? `${due} due` : null].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Recent Chat Section */}
        {recentChats.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)', marginTop: 'var(--sp-2)' }}>
            {!isSidebarCollapsed && (
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)', padding: '0 var(--sp-3)', marginBottom: 4 }}>
                Recent Chats
              </span>
            )}
            {recentChats.map((session: any) => {
              const isActive = pathname === `/chat/sessions/${session.id}`;
              return (
                <Link
                  key={session.id}
                  href={`/chat/sessions/${session.id}`}
                  className="nav-link-base"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-3)',
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderRadius: 'var(--radius-md)',
                    color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                    background: isActive ? 'var(--accent-blue-dim)' : 'transparent',
                    textDecoration: 'none',
                    transition: 'all 0.2s',
                  }}
                  title={isSidebarCollapsed ? session.title : undefined}
                  onClick={() => setMobileSidebarOpen(false)}
                >
                  <MessageCircle size={16} strokeWidth={isActive ? 2.5 : 2} style={{ flexShrink: 0 }} />
                  {!isSidebarCollapsed && (
                    <span style={{
                      fontSize: 'var(--fs-xs)',
                      fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      opacity: 1,
                      transition: 'opacity 0.2s',
                    }}>
                      {session.title || 'New Chat'}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

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
              <a
                href="/api/billing/checkout"
                style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-blue)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <CreditCard size={11} /> Upgrade
              </a>
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

      {isGoalModalOpen && <GoalCreationModal onClose={() => setIsGoalModalOpen(false)} />}

    </aside>
  );
}
