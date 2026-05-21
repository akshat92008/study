'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  MessageSquare, Zap, X, ChevronLeft, ChevronRight, Plus, Check, Loader2, Target, Calendar, Clock, Sliders, Sparkles, LogOut
} from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { motion, AnimatePresence } from 'framer-motion';
import { signOut } from '@/lib/actions/auth';

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
    setActiveGoalId,
    loadLearningGoals,
    createLearningGoal
  } = useAppStore();

  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState('');
  const [deadline, setDeadline] = useState('');
  const [currentLevel, setCurrentLevel] = useState('beginner');
  const [learningStyle, setLearningStyle] = useState('read_write');
  const [dailyHours, setDailyHours] = useState(8);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadLearningGoals();
  }, [loadLearningGoals]);

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGoalTitle.trim() || !deadline || isSubmitting) return;

    setIsSubmitting(true);
    const created = await createLearningGoal(newGoalTitle.trim(), {
      deadline,
      currentLevel,
      timeAvailable: dailyHours,
      preferredLearningStyle: learningStyle,
    });
    setIsSubmitting(false);

    if (created) {
      setNewGoalTitle('');
      setDeadline('');
      setCurrentLevel('beginner');
      setLearningStyle('read_write');
      setDailyHours(8);
      setIsAddingGoal(false);
      // Automatically redirect to dashboard if not already there
      if (pathname !== '/dashboard') {
        router.push('/dashboard');
      }
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
              {examType} Engine
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
        {/* Workspace Link */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
          <Link
            href="/dashboard"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: isSidebarCollapsed ? 0 : 'var(--sp-3)',
              justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
              padding: isSidebarCollapsed ? 'var(--sp-3)' : 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--fs-sm)',
              fontWeight: pathname === '/dashboard' ? 'var(--fw-semibold)' : 'var(--fw-normal)',
              color: pathname === '/dashboard' ? 'var(--text-primary)' : 'var(--text-secondary)',
              background: pathname === '/dashboard' ? 'var(--bg-tertiary)' : 'transparent',
              textDecoration: 'none',
              transition: 'all var(--duration-fast) var(--ease-out)',
              position: 'relative',
            }}
          >
            {pathname === '/dashboard' && (
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
            <MessageSquare size={18} style={{ opacity: pathname === '/dashboard' ? 1 : 0.6, flexShrink: 0 }} />
            <span
              style={{
                opacity: isSidebarCollapsed ? 0 : 1,
                width: isSidebarCollapsed ? 0 : 'auto',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                flex: 1,
                transition: 'opacity var(--duration-fast) var(--ease-out)',
              }}
            >
              Conversational OS
            </span>
          </Link>
        </div>

        {/* Learning Goals Section */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: isSidebarCollapsed ? 'center' : 'space-between',
              padding: '0 var(--sp-3)',
              marginBottom: 4,
            }}
          >
            {!isSidebarCollapsed && (
              <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-bold)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: 'var(--ls-wide)' }}>
                Learning Goals
              </span>
            )}
            <button
              onClick={() => setIsAddingGoal(!isAddingGoal)}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '2px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Add New Learning Goal"
            >
              <Plus size={14} />
            </button>
          </div>

          {/* New Goal Input Inline removed - now uses Modal */}

          {/* Goals List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {learningGoals.map((goal) => {
              const isGoalActive = activeGoalId === goal.id;
              return (
                <button
                  key={goal.id}
                  onClick={() => {
                    setActiveGoalId(goal.id);
                    if (pathname !== '/dashboard') {
                      router.push('/dashboard');
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: isSidebarCollapsed ? 0 : 'var(--sp-3)',
                    justifyContent: isSidebarCollapsed ? 'center' : 'flex-start',
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderRadius: 'var(--radius-md)',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: 'var(--fs-sm)',
                    fontWeight: isGoalActive ? 'var(--fw-semibold)' : 'var(--fw-normal)',
                    color: isGoalActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    background: isGoalActive ? 'var(--bg-secondary)' : 'transparent',
                    width: '100%',
                    textAlign: 'left',
                    transition: 'all var(--duration-fast) var(--ease-out)',
                    position: 'relative',
                  }}
                >
                  {isGoalActive && (
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: '25%',
                        bottom: '25%',
                        width: 3,
                        background: 'var(--accent-purple)',
                        borderRadius: 2,
                      }}
                    />
                  )}
                  {isSidebarCollapsed ? (
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 'var(--radius-full)',
                        background: isGoalActive ? 'var(--accent-purple-dim)' : 'var(--bg-tertiary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        color: isGoalActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {goal.title.charAt(0).toUpperCase()}
                    </div>
                  ) : (
                    <>
                      <Target size={16} style={{ color: isGoalActive ? 'var(--accent-purple)' : 'var(--text-tertiary)', flexShrink: 0 }} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          flex: 1,
                        }}
                      >
                        {goal.title}
                      </span>
                      {goal.confidence_score !== null && goal.confidence_score !== undefined && (
                        <span
                          style={{
                            fontSize: '9px',
                            padding: '2px 6px',
                            background: 'var(--bg-tertiary)',
                            borderRadius: 'var(--radius-full)',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--accent-cyan)',
                          }}
                        >
                          {Math.round(goal.confidence_score)}%
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}

            {learningGoals.length === 0 && !isSidebarCollapsed && (
              <div style={{ padding: 'var(--sp-2) var(--sp-3)', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
                No active goals.
              </div>
            )}
          </div>
        </div>
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

      {/* Goal Ingestion Modal */}
      <AnimatePresence>
        {isAddingGoal && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: 'var(--sp-4)'
          }}>
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: 'var(--bg-primary)', border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-lg)', width: '100%', maxWidth: '500px',
                display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'var(--shadow-xl)'
              }}
            >
              {/* Header */}
              <div style={{ padding: 'var(--sp-4) var(--sp-5)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Sparkles size={18} style={{ color: 'var(--accent-purple)' }} />
                  <span style={{ fontWeight: 'bold', fontSize: 'var(--fs-md)', color: 'var(--text-primary)' }}>
                    Create New Learning Goal
                  </span>
                </div>
                <button 
                  onClick={() => setIsAddingGoal(false)}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Form Body */}
              <form onSubmit={handleAddGoal} style={{ padding: 'var(--sp-5)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
                {/* Title */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    What do you want to learn?
                  </label>
                  <input
                    value={newGoalTitle}
                    onChange={(e) => setNewGoalTitle(e.target.value)}
                    placeholder="e.g. Machine Learning, NEET Chemistry, CFA Level 1"
                    required
                    style={{
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                      fontSize: 'var(--fs-sm)', outline: 'none'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  />
                </div>

                {/* Deadline */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    Target Completion Date
                  </label>
                  <input
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    required
                    style={{
                      background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                      fontSize: 'var(--fs-sm)', outline: 'none', width: '100%'
                    }}
                    onFocus={e => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
                    onBlur={e => e.currentTarget.style.borderColor = 'var(--border-default)'}
                  />
                </div>

                {/* Level & Style Row */}
                <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Current Level
                    </label>
                    <select
                      value={currentLevel}
                      onChange={(e) => setCurrentLevel(e.target.value)}
                      style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                        fontSize: 'var(--fs-sm)', outline: 'none', width: '100%', cursor: 'pointer'
                      }}
                    >
                      <option value="beginner">Beginner</option>
                      <option value="intermediate">Intermediate</option>
                      <option value="advanced">Advanced</option>
                    </select>
                  </div>

                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                    <label style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                      Learning Style
                    </label>
                    <select
                      value={learningStyle}
                      onChange={(e) => setLearningStyle(e.target.value)}
                      style={{
                        background: 'var(--bg-secondary)', border: '1px solid var(--border-default)',
                        borderRadius: 'var(--radius-md)', padding: '10px 12px', color: 'var(--text-primary)',
                        fontSize: 'var(--fs-sm)', outline: 'none', width: '100%', cursor: 'pointer'
                      }}
                    >
                      <option value="read_write">Text & Writing</option>
                      <option value="visual">Visual diagrams</option>
                      <option value="auditory">Auditory & lectures</option>
                      <option value="kinesthetic">Practical projects</option>
                    </select>
                  </div>
                </div>

                {/* Daily Study Hours */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    <span>Daily Hours Allocated</span>
                    <span style={{ color: 'var(--accent-purple)' }}>{dailyHours} hours/day</span>
                  </label>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    value={dailyHours}
                    onChange={(e) => setDailyHours(Number(e.target.value))}
                    style={{ accentColor: 'var(--accent-purple)', cursor: 'pointer' }}
                  />
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
                  <button
                    type="button"
                    onClick={() => setIsAddingGoal(false)}
                    style={{
                      flex: 1, padding: '10px 16px', background: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-strong)', color: 'var(--text-primary)',
                      borderRadius: 'var(--radius-md)', cursor: 'pointer', fontWeight: 600, fontSize: 'var(--fs-sm)'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !newGoalTitle.trim() || !deadline}
                    style={{
                      flex: 1, padding: '10px 16px', background: 'var(--accent-purple)',
                      border: 'none', color: 'white', borderRadius: 'var(--radius-md)',
                      cursor: 'pointer', fontWeight: 700, fontSize: 'var(--fs-sm)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      boxShadow: 'var(--shadow-glow-purple-dim)'
                    }}
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        Generating Roadmap...
                      </>
                    ) : (
                      'Generate Roadmap'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </aside>
  );
}
