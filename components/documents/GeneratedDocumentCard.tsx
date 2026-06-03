'use client';

// components/documents/GeneratedDocumentCard.tsx
// Renders a GeneratedDocument as a beautiful structured card.
// Features:
//   - Status badge (Correct / Incorrect / Unattempted) BEFORE question text
//   - Download PDF button (calls /api/documents/export-pdf)
//   - Copy Text button
//   - Collapsible answer key table
//   - Mobile-friendly, no heavy animations

import React, { useState, useCallback } from 'react';
import {
  Download, Copy, Check, ChevronDown, ChevronUp,
  BookOpen, AlertCircle, CheckCircle, XCircle, Clock,
  FileText, Beaker
} from 'lucide-react';
import type {
  GeneratedDocument,
  MockTestDocument,
  MCQQuestion,
  QuestionStatus,
} from '@/lib/documents/document-types';
import { documentToText } from '@/lib/documents/document-to-text';

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: QuestionStatus | undefined }) {
  if (!status || status === 'unattempted') return null;

  const cfg = {
    correct: {
      icon: <CheckCircle size={11} />,
      label: 'Correct',
      bg: 'rgba(74,222,128,0.12)',
      border: 'rgba(74,222,128,0.4)',
      color: '#4ade80',
    },
    incorrect: {
      icon: <XCircle size={11} />,
      label: 'Incorrect',
      bg: 'rgba(248,113,113,0.12)',
      border: 'rgba(248,113,113,0.4)',
      color: '#f87171',
    },
  } as const;

  const c = cfg[status];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      padding: '1px 7px', borderRadius: 4, fontSize: 10,
      fontWeight: 700, letterSpacing: '0.02em',
      background: c.bg, border: `1px solid ${c.border}`, color: c.color,
      flexShrink: 0, marginRight: 6,
      verticalAlign: 'middle',
    }}>
      {c.icon}
      {c.label}
    </span>
  );
}

// ── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be blocked in some contexts
    }
  }, [text]);

  return (
    <button
      id="doc-card-copy-btn"
      onClick={handleCopy}
      title="Copy text"
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 11px', borderRadius: 6, cursor: 'pointer',
        fontSize: 11, fontWeight: 600,
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        color: copied ? '#4ade80' : 'var(--text-secondary)',
        transition: 'color 0.15s',
      }}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

// ── Download PDF Button ───────────────────────────────────────────────────────

function DownloadPDFButton({ doc }: { doc: GeneratedDocument }) {
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');

  const handleDownload = useCallback(async () => {
    if (state === 'loading') return;
    setState('loading');

    try {
      const res = await fetch('/api/documents/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ document: doc }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: 'Export failed' }));
        console.error('[PDF Export]', err);
        setState('error');
        setTimeout(() => setState('idle'), 3000);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] || 'document.pdf';
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setState('idle');
    } catch (err) {
      console.error('[PDF Export]', err);
      setState('error');
      setTimeout(() => setState('idle'), 3000);
    }
  }, [doc, state]);

  const label = state === 'loading' ? 'Generating…' : state === 'error' ? 'Failed' : 'PDF';
  const color = state === 'error' ? '#f87171' : 'var(--text-secondary)';

  return (
    <button
      id="doc-card-pdf-btn"
      onClick={handleDownload}
      disabled={state === 'loading'}
      title="Download PDF (selectable text)"
      style={{
        display: 'flex', alignItems: 'center', gap: 4,
        padding: '5px 11px', borderRadius: 6,
        cursor: state === 'loading' ? 'default' : 'pointer',
        fontSize: 11, fontWeight: 600,
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        color, opacity: state === 'loading' ? 0.7 : 1,
        transition: 'opacity 0.15s',
      }}
    >
      <Download size={11} />
      {label}
    </button>
  );
}

// ── Subject Chip ──────────────────────────────────────────────────────────────

function SubjectChip({ subject }: { subject: string }) {
  const colors: Record<string, { bg: string; color: string }> = {
    Physics:   { bg: 'rgba(59,130,246,0.12)',  color: '#60a5fa' },
    Chemistry: { bg: 'rgba(245,158,11,0.12)',  color: '#fbbf24' },
    Biology:   { bg: 'rgba(74,222,128,0.12)',  color: '#4ade80' },
    General:   { bg: 'rgba(139,92,246,0.12)', color: '#a78bfa' },
  };
  const c = colors[subject] || colors.General;
  return (
    <span style={{
      padding: '2px 8px', borderRadius: 4, fontSize: 10, fontWeight: 600,
      background: c.bg, color: c.color,
    }}>
      {subject}
    </span>
  );
}

// ── Mock Test Question ────────────────────────────────────────────────────────

function MCQQuestionRow({ q, index }: { q: MCQQuestion; index: number }) {
  const [showExplanation, setShowExplanation] = useState(false);
  const hasExplanation = !!q.explanation;

  const statusColor =
    q.status === 'correct' ? '#4ade80'
      : q.status === 'incorrect' ? '#f87171'
        : 'var(--text-tertiary)';

  return (
    <div style={{
      border: '1px solid var(--border-subtle)',
      borderRadius: 10, overflow: 'hidden',
      background: 'var(--bg-secondary)',
      marginBottom: 10,
    }}>
      {/* Question Header */}
      <div style={{ padding: '12px 14px 6px' }}>
        {/* Q number + status badge + subject · chapter */}
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 6,
          flexWrap: 'wrap', marginBottom: 6,
        }}>
          <span style={{ fontWeight: 800, fontSize: 12, color: 'var(--accent-purple)', flexShrink: 0 }}>
            Q{q.number}.
          </span>
          {/* Status badge appears BEFORE question text per spec */}
          <StatusBadge status={q.status} />
          {q.subject && q.subject !== 'General' && (
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
              {[q.subject, q.chapter].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>

        {/* Question text */}
        <p style={{
          margin: 0, fontSize: 13, color: 'var(--text-primary)',
          lineHeight: 1.6, fontWeight: 500,
        }}>
          {q.question}
        </p>
      </div>

      {/* Options */}
      <div style={{ padding: '6px 14px 10px', display: 'flex', flexDirection: 'column', gap: 5 }}>
        {(['A', 'B', 'C', 'D'] as const).map(letter => {
          const optText = q.options[letter];
          if (!optText) return null;
          const isCorrect = q.correctAnswer === letter;
          const isIncorrectPick = q.status === 'incorrect' && letter !== q.correctAnswer && false; // we don't know user pick
          return (
            <div
              key={letter}
              style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '6px 10px', borderRadius: 6,
                background: isCorrect
                  ? 'rgba(74,222,128,0.08)'
                  : 'transparent',
                border: isCorrect
                  ? '1px solid rgba(74,222,128,0.25)'
                  : '1px solid var(--border-subtle)',
              }}
            >
              <span style={{
                fontWeight: 800, fontSize: 11, minWidth: 16,
                color: isCorrect ? '#4ade80' : 'var(--text-tertiary)',
                marginTop: 2, flexShrink: 0,
              }}>
                {letter}.
              </span>
              <span style={{
                fontSize: 12.5, lineHeight: 1.5,
                color: isCorrect ? '#4ade80' : 'var(--text-secondary)',
                fontWeight: isCorrect ? 600 : 400,
              }}>
                {optText}
              </span>
              {isCorrect && (
                <CheckCircle
                  size={13}
                  style={{ marginLeft: 'auto', flexShrink: 0, marginTop: 3, color: '#4ade80' }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Footer: correct answer + explanation toggle */}
      <div style={{
        padding: '6px 14px 10px',
        borderTop: '1px solid var(--border-subtle)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        flexWrap: 'wrap', gap: 6,
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#4ade80' }}>
          ✓ Correct Answer: {q.correctAnswer}
        </span>
        {hasExplanation && (
          <button
            onClick={() => setShowExplanation(v => !v)}
            style={{
              fontSize: 10, fontWeight: 600, cursor: 'pointer',
              background: 'transparent', border: 'none',
              color: 'var(--text-tertiary)', display: 'flex', alignItems: 'center', gap: 3,
            }}
          >
            Explanation
            {showExplanation ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
      </div>

      {showExplanation && q.explanation && (
        <div style={{
          padding: '10px 14px 12px',
          background: 'rgba(139,92,246,0.06)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.65,
        }}>
          {q.explanation}
        </div>
      )}
    </div>
  );
}

// ── Answer Key Table ──────────────────────────────────────────────────────────

function AnswerKeyTable({ doc }: { doc: MockTestDocument }) {
  const [open, setOpen] = useState(false);

  const statusIcon = (status: QuestionStatus | undefined) => {
    if (status === 'correct') return '✓';
    if (status === 'incorrect') return '✗';
    return '—';
  };

  const statusColor = (status: QuestionStatus | undefined): string => {
    if (status === 'correct') return '#4ade80';
    if (status === 'incorrect') return '#f87171';
    return 'var(--text-tertiary)';
  };

  return (
    <div style={{ marginTop: 12 }}>
      <button
        id="doc-card-answer-key-toggle"
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontSize: 12, fontWeight: 700,
          color: 'var(--text-secondary)',
          background: 'var(--bg-tertiary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 6, padding: '6px 12px',
          cursor: 'pointer',
        }}
      >
        <FileText size={12} />
        Answer Key
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>

      {open && (
        <div style={{
          marginTop: 8, borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          overflow: 'auto',
          maxHeight: 340,
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-tertiary)' }}>
                {['Q No', 'Subject', 'Chapter', 'Answer', 'Status'].map(h => (
                  <th key={h} style={{
                    padding: '6px 10px', textAlign: 'left', fontWeight: 700,
                    color: 'var(--text-tertiary)', fontSize: 10,
                    borderBottom: '1px solid var(--border-subtle)',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {doc.questions.map(q => (
                <tr key={q.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '5px 10px', color: 'var(--text-secondary)', fontWeight: 600 }}>
                    {q.number}
                  </td>
                  <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>
                    {q.subject}
                  </td>
                  <td style={{ padding: '5px 10px', color: 'var(--text-secondary)' }}>
                    {q.chapter || '—'}
                  </td>
                  <td style={{ padding: '5px 10px', fontWeight: 700, color: '#4ade80' }}>
                    {q.correctAnswer}
                  </td>
                  <td style={{ padding: '5px 10px', fontWeight: 600, color: statusColor(q.status) }}>
                    {statusIcon(q.status)} {q.status || 'unattempted'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Mock Test Card ────────────────────────────────────────────────────────────

function MockTestCard({ doc }: { doc: MockTestDocument }) {
  const [collapsed, setCollapsed] = useState(false);
  const plainText = documentToText(doc);

  const correctCount = doc.questions.filter(q => q.status === 'correct').length;
  const incorrectCount = doc.questions.filter(q => q.status === 'incorrect').length;
  const hasStatus = doc.questions.some(q => q.status && q.status !== 'unattempted');

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 2px 16px rgba(0,0,0,0.18)',
      margin: '4px 0',
    }}>
      {/* ── Card Header ─────────────────────────────────────────────────────── */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
        padding: '14px 16px',
      }}>
        {/* Top row: icon + title + collapse toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: 'var(--accent-purple)', borderRadius: 8, padding: 7, display: 'flex', flexShrink: 0,
          }}>
            <BookOpen size={14} color="white" />
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {doc.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
              {doc.exam} Mock Test · {doc.metadata.totalQuestions} Questions
              {doc.metadata.durationMinutes ? ` · ${doc.metadata.durationMinutes} min` : ''}
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
            <DownloadPDFButton doc={doc} />
            <CopyButton text={plainText} />
            <button
              onClick={() => setCollapsed(v => !v)}
              style={{
                background: 'transparent', border: 'none',
                color: 'var(--text-tertiary)', cursor: 'pointer',
                display: 'flex', alignItems: 'center', padding: 2,
              }}
            >
              {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
          </div>
        </div>

        {/* Subject chips + score summary */}
        {!collapsed && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, alignItems: 'center' }}>
            {doc.metadata.subjects.map(s => (
              <SubjectChip key={s} subject={s} />
            ))}
            {hasStatus && (
              <>
                <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#4ade80' }}>
                  ✓ {correctCount} correct
                </span>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#f87171' }}>
                  ✗ {incorrectCount} incorrect
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Card Body ────────────────────────────────────────────────────────── */}
      {!collapsed && (
        <div style={{ padding: '14px 16px' }}>
          {doc.questions.map((q, i) => (
            <MCQQuestionRow key={q.id} q={q} index={i} />
          ))}
          <AnswerKeyTable doc={doc} />
        </div>
      )}
    </div>
  );
}

// ── Generic Fallback Card ─────────────────────────────────────────────────────

function FallbackDocumentCard({ doc }: { doc: GeneratedDocument }) {
  const [collapsed, setCollapsed] = useState(false);
  const plainText = documentToText(doc);
  const title = 'title' in doc ? doc.title : 'Generated Document';

  return (
    <div style={{
      background: 'var(--bg-primary)',
      border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      margin: '4px 0',
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(59,130,246,0.08))',
        borderBottom: collapsed ? 'none' : '1px solid var(--border-subtle)',
        padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            background: '#6366f1', borderRadius: 8, padding: 6, display: 'flex',
          }}>
            <FileText size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>{title}</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{doc.kind.replace('_', ' ')}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <DownloadPDFButton doc={doc} />
          <CopyButton text={plainText} />
          <button
            onClick={() => setCollapsed(v => !v)}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          </button>
        </div>
      </div>
      {!collapsed && (
        <div style={{ padding: '16px', whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {plainText}
        </div>
      )}
    </div>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

interface GeneratedDocumentCardProps {
  document: GeneratedDocument;
}

/**
 * Renders a GeneratedDocument as a structured card.
 * Status badge appears BEFORE question text for mock_test documents.
 * Includes Download PDF and Copy Text buttons at the top.
 */
export function GeneratedDocumentCard({ document }: GeneratedDocumentCardProps) {
  if (document.kind === 'mock_test') {
    return <MockTestCard doc={document} />;
  }
  return <FallbackDocumentCard doc={document} />;
}
