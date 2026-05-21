'use client';

import React from 'react';

interface ScoreBridgeProps {
  currentScore: number;
  recoverableMarks: number;
  potentialScore: number;
  examType: string;
  mentorQuote: string;
  categoryBreakdown: Array<{ name: string; value: number }>;
  chapterLoss: Array<{ chapter: string; marksLost: number }>;
}

export default function ScoreBridge({
  currentScore,
  recoverableMarks,
  potentialScore,
  examType,
  mentorQuote,
  categoryBreakdown,
  chapterLoss
}: ScoreBridgeProps) {
  // Sort and limit lists to top 5
  const topCategories = [...(categoryBreakdown || [])]
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
    
  const topChapters = [...(chapterLoss || [])]
    .sort((a, b) => b.marksLost - a.marksLost)
    .slice(0, 5);

  const maxCategoryValue = Math.max(...topCategories.map(c => c.value), 1);

  // Helper to determine bar color based on category name
  const getBarColor = (name: string) => {
    const key = name.toLowerCase().replace(/_/g, ' ');
    if (key.includes('conceptual')) return 'var(--accent-purple)';
    if (key.includes('calculation')) return 'var(--accent-amber)';
    if (key.includes('silly')) return 'var(--text-muted)';
    if (key.includes('time pressure')) return '#ef4444';
    if (key.includes('anxiety')) return '#f97316';
    return 'var(--accent-blue)';
  };

  const capitalize = (str: string) => {
    return str.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  return (
    <div style={{
      background: 'var(--glass-bg, rgba(17, 24, 39, 0.7))',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid var(--border-subtle, rgba(255, 255, 255, 0.08))',
      borderRadius: 'var(--radius-xl, 16px)',
      padding: 'var(--sp-6)',
      display: 'flex',
      flexDirection: 'column',
      gap: 'var(--sp-6)',
      boxShadow: 'var(--shadow-glow-purple, 0 8px 32px 0 rgba(168, 85, 247, 0.05))',
      color: 'var(--text-primary)'
    }}>
      {/* 1. TOP SECTION — Three score columns side by side */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        textAlign: 'center',
        padding: 'var(--sp-4) 0',
        background: 'rgba(255, 255, 255, 0.01)',
        borderRadius: 'var(--radius-lg, 12px)',
        border: '1px solid rgba(255, 255, 255, 0.02)'
      }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase' }}>
            ACTUAL
          </div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', margin: 'var(--sp-1) 0' }}>
            {currentScore}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-muted)' }}>
            Your score
          </div>
        </div>

        <div style={{ fontSize: 'var(--fs-xl)', color: 'var(--text-muted)', userSelect: 'none' }}>→</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-amber)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase' }}>
            RECOVERABLE
          </div>
          <div style={{ fontSize: 'var(--fs-4xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-amber)', margin: 'var(--sp-1) 0' }}>
            {currentScore + recoverableMarks}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-amber)' }}>
            Fix silly mistakes
          </div>
        </div>

        <div style={{ fontSize: 'var(--fs-xl)', color: 'var(--text-muted)', userSelect: 'none' }}>→</div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-wide)', textTransform: 'uppercase' }}>
            POTENTIAL
          </div>
          <div style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)', margin: 'var(--sp-1) 0' }}>
            {potentialScore}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--accent-cyan)' }}>
            Full potential
          </div>
        </div>
      </div>

      {/* 2. MIDDLE SECTION — Mentor Quote box */}
      {mentorQuote && (
        <div style={{
          background: 'var(--glass-bg, rgba(255, 255, 255, 0.02))',
          borderLeft: '3px solid var(--accent-cyan)',
          borderRadius: '0 var(--radius-md, 8px) var(--radius-md, 8px) 0',
          padding: 'var(--sp-4)',
          boxShadow: 'inset 0 0 12px rgba(255, 255, 255, 0.01)'
        }}>
          <div style={{
            fontSize: 'var(--fs-sm)',
            fontStyle: 'italic',
            color: 'var(--text-secondary)',
            lineHeight: 'var(--lh-relaxed)'
          }}>
            &ldquo;{mentorQuote}&rdquo;
          </div>
        </div>
      )}

      {/* BOTTOM SECTION - Splits category breakdown and chapter loss */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 'var(--sp-6)',
        marginTop: 'var(--sp-2)'
      }}>
        {/* 3. BOTTOM LEFT — Category breakdown as horizontal bars */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-2)', margin: 0 }}>
            Mistakes by Type
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {topCategories.length > 0 ? (
              topCategories.map((c, i) => {
                const percentage = (c.value / maxCategoryValue) * 100;
                return (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-1)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
                      <span>{capitalize(c.name)}</span>
                      <span style={{ fontWeight: 'var(--fw-bold)', fontFamily: 'var(--font-mono)' }}>{c.value}</span>
                    </div>
                    <div style={{
                      width: '100%',
                      height: '6px',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-full, 9999px)',
                      overflow: 'hidden'
                    }}>
                      <div style={{
                        width: `${percentage}%`,
                        height: '100%',
                        background: getBarColor(c.name),
                        borderRadius: 'var(--radius-full, 9999px)',
                        boxShadow: `0 0 8px ${getBarColor(c.name)}40`
                      }} />
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No mistake category data available.
              </div>
            )}
          </div>
        </div>

        {/* 4. BOTTOM RIGHT — Chapter loss as ranked list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <h4 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--sp-2)', margin: 0 }}>
            Marks Lost by Chapter
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {topChapters.length > 0 ? (
              topChapters.map((c, i) => (
                <div key={i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: 'var(--sp-2) var(--sp-3)',
                  background: 'rgba(255, 255, 255, 0.01)',
                  border: '1px solid rgba(255, 255, 255, 0.02)',
                  borderRadius: 'var(--radius-md, 8px)'
                }}>
                  <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                    {c.chapter}
                  </span>
                  <span style={{
                    fontSize: 'var(--fs-xs)',
                    fontWeight: 'var(--fw-bold)',
                    color: '#ef4444',
                    fontFamily: 'var(--font-mono)',
                    background: 'rgba(239, 68, 68, 0.1)',
                    padding: '2px 8px',
                    borderRadius: 'var(--radius-full, 9999px)'
                  }}>
                    -{c.marksLost} marks
                  </span>
                </div>
              ))
            ) : (
              <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                No chapter loss data available.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
