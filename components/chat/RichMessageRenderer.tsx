'use client';

import React, { useState } from 'react';
import {
  BookOpen, CheckCircle, XCircle, ChevronDown, ChevronUp,
  Download, Copy, Check, Brain, Zap, AlertTriangle,
  FileText, Layout, List, Map, Calendar, RotateCcw,
  ChevronRight, ChevronLeft, Eye, EyeOff
} from 'lucide-react';

// ── TYPES ──────────────────────────────────────────────────────────────────────

interface ParsedArtifact {
  type: 'study-guide' | 'practice-test' | 'revision-sheet' | 'flashcard-set' | 'concept-map' | 'study-plan' | 'pdf';
  topic: string;
  subject?: string;
  content: string;
  attributes: Record<string, string>;
}

interface ParsedQuestion {
  number: number;
  text: string;
  options: string[];
  answer: string;
  explanation: string;
  examRelevance?: string;
}

interface ParsedFlashcard {
  number: number;
  front: string;
  back: string;
}

// ── ARTIFACT PARSER ────────────────────────────────────────────────────────────

function parseArtifacts(content: string): Array<{ type: 'text' | 'artifact'; content: string; artifact?: ParsedArtifact }> {
  const parts: Array<{ type: 'text' | 'artifact'; content: string; artifact?: ParsedArtifact }> = [];
  const artifactRegex = /<artifact([^>]*)>([\s\S]*?)<\/artifact>/g;
  let lastIndex = 0;
  let match;

  while ((match = artifactRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push({ type: 'text', content: text });
    }

    const attrString = match[1];
    const artifactContent = match[2].trim();
    const attrs: Record<string, string> = {};
    const attrRegex = /(\w+)="([^"]*?)"/g;
    let attrMatch;
    while ((attrMatch = attrRegex.exec(attrString)) !== null) {
      attrs[attrMatch[1]] = attrMatch[2];
    }

    parts.push({
      type: 'artifact',
      content: artifactContent,
      artifact: {
        type: attrs.type as any || 'study-guide',
        topic: attrs.topic || 'Concept',
        subject: attrs.subject,
        content: artifactContent,
        attributes: attrs
      }
    });

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) parts.push({ type: 'text', content: remaining });
  }

  return parts.length > 0 ? parts : [{ type: 'text', content }];
}

// ── MARKDOWN RENDERER ──────────────────────────────────────────────────────────

function renderMarkdownInline(text: string): React.ReactNode {
  if (!text) return null;
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\[\[concept:[^\]]+\]\])/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i} style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('__') && part.endsWith('__')) return <strong key={i} style={{ fontWeight: 700 }}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={i} style={{ background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: '0.9em' }}>{part.slice(1, -1)}</code>;
    const conceptMatch = part.match(/\[\[concept:([^\]]+)\]\]/);
    if (conceptMatch) return <span key={i} className="conceptHighlight">{conceptMatch[1]}</span>;
    return part;
  });
}

function renderMarkdownBlock(text: string): React.ReactNode {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeLines: string[] = [];
  let codeLang = '';

  const flushList = () => {
    if (listItems.length > 0) {
      elements.push(<ul key={elements.length} style={{ margin: '8px 0', paddingLeft: 20 }}>{listItems}</ul>);
      listItems = [];
    }
  };

  // exam‑trap handling
  let inExamTrap = false;
  let examBuffer: string[] = [];

  lines.forEach((line, idx) => {
    if (line.startsWith('```')) {
      if (!inCodeBlock) {
        flushList();
        inCodeBlock = true;
        codeLang = line.slice(3).trim();
        codeLines = [];
      } else {
        elements.push(
          <pre key={idx} style={{
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
            borderRadius: 8, padding: '12px 16px', overflowX: 'auto',
            fontFamily: 'var(--font-mono)', fontSize: 12, margin: '8px 0', color: 'var(--text-primary)'
          }}>
            <code>{codeLines.join('\n')}</code>
          </pre>
        );
        inCodeBlock = false;
        codeLines = [];
      }
      return;
    }
    if (inCodeBlock) { codeLines.push(line); return; }

    // start of exam‑trap block
    if (line.trim() === '[[exam-trap]]') {
      flushList();
      inExamTrap = true;
      examBuffer = [];
      return;
    }
    // end of exam‑trap block
    if (line.trim() === '[[/exam-trap]]') {
      const content = examBuffer.join('\n');
      elements.push(
        <div key={idx} className="examTrapBox" style={{
          background: 'rgba(255,99,71,0.08)',
          border: '1px solid rgba(255,99,71,0.25)',
          borderRadius: 8,
          padding: '12px',
          margin: '8px 0'
        }}>
          {renderMarkdownBlock(content)}
        </div>
      );
      inExamTrap = false;
      examBuffer = [];
      return;
    }
    if (inExamTrap) { examBuffer.push(line); return; }

    if (line.startsWith('### ')) { flushList(); elements.push(<h4 key={idx} style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', margin: '14px 0 6px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 4 }}>{renderMarkdownInline(line.slice(4))}</h4>); return; }
    if (line.startsWith('## ')) { flushList(); elements.push(<h3 key={idx} style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', margin: '16px 0 8px' }}>{renderMarkdownInline(line.slice(3))}</h3>); return; }
    if (line.startsWith('# ')) { flushList(); elements.push(<h2 key={idx} style={{ fontSize: 17, fontWeight: 900, color: 'var(--text-primary)', margin: '16px 0 8px' }}>{renderMarkdownInline(line.slice(2))}</h2>); return; }
    if (line.match(/^[-•]\s/)) { listItems.push(<li key={idx} style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, padding: '2px 0' }}>{renderMarkdownInline(line.slice(2))}</li>); return; }
    if (line.match(/^\d+\.\s/)) { listItems.push(<li key={idx} style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6, padding: '2px 0', listStyleType: 'decimal' }}>{renderMarkdownInline(line.replace(/^\d+\.\s/, ''))}</li>); return; }

    flushList();
    if (line.trim() === '') { elements.push(<div key={idx} style={{ height: 8 }} />); return; }
    elements.push(<p key={idx} style={{ margin: '3px 0', color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65 }}>{renderMarkdownInline(line)}</p>);
  });

  flushList();
  return <>{elements}</>;
}

// ── COPY BUTTON ────────────────────────────────────────────────────────────────

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button onClick={handleCopy} style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
      borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
      transition: 'all 0.15s'
    }}>
      {copied ? <><Check size={11} style={{ color: '#4ade80' }} /> Copied</> : <><Copy size={11} /> {label}</>}
    </button>
  );
}

// ── DOWNLOAD BUTTONS ──────────────────────────────────────────────────────────

function DownloadMdButton({ text, filename = 'document' }: { text: string; filename?: string }) {
  const handleDownload = () => {
    const blob = new Blob([text], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <button onClick={handleDownload} title="Download Markdown" style={{
      display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px',
      background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
      borderRadius: 6, cursor: 'pointer', fontSize: 11, color: 'var(--text-secondary)',
      transition: 'all 0.15s'
    }}>
      <Download size={11} /> .md
    </button>
  );
}

function markdownToHtml(markdown: string) {
  // Escape HTML entities
  let html = markdown
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/__(.+?)__/g, '<strong>$1</strong>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr/>')
    // Bullet lists (including various symbols)
    .replace(/^[\-\*•⚡📐🔗⚠️🏆]\s+(.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // Q&A for practice tests
    .replace(/^(Q\d+[:.])\s+(.+)$/gm, '<p class="question"><strong>$1</strong> $2</p>')
    .replace(/^(ANSWER[:.])\s+(.+)$/gm, '<p class="answer"><strong>$1</strong> $2</p>')
    .replace(/^(EXPLANATION[:.])\s+(.+)$/gm, '<p class="explanation">$2</p>')
    // Flashcard delimiters
    .replace(/^CARD \d+$/gm, '<div class="card-divider"></div>')
    .replace(/^FRONT[:]\s+(.+)$/gm, '<p class="card-front"><strong>Q:</strong> $1</p>')
    .replace(/^BACK[:]\s+(.+)$/gm, '<p class="card-back"><strong>A:</strong> $1</p>')
    // Paragraph breaks
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');

  // Ensure content is wrapped in <p> if needed
  if (!html.match(/^<(h[1-3]|ul|li|hr|div|p)/)) {
    html = `<p>${html}</p>`;
  }
  return html;
}

// ── PDF DOWNLOAD ────────────────────────────────────────────────────────────────

function downloadMarkdownAsPDF(content: string, filename: string) {
  const loadJsPdf = () => {
    return new Promise<any>((resolve, reject) => {
      if ((window as any).jsPDF) { resolve((window as any).jsPDF); return; }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
      script.onload = () => {
        if ((window as any).jsPDF) resolve((window as any).jsPDF);
        else reject();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  };

  loadJsPdf()
    .then((jsPDFModule) => {
      const { jsPDF } = jsPDFModule;
      const doc = new jsPDF();
      doc.html(markdownToHtml(content), {
        callback: (doc: any) => {
          doc.save(`${filename.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
        },
        x: 10,
        y: 10,
        width: 180,
      });
    })
    .catch(() => alert('PDF generation failed. Please try again.'));
}

function DownloadPdfButton({
  text,
  filename = 'document',
}: {
  text: string;
  filename?: string;
}) {
  const [loading, setLoading] = React.useState(false);
  const handleClick = () => {
    setLoading(true);
    downloadMarkdownAsPDF(text, filename);
    setTimeout(() => setLoading(false), 800);
  };
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Save as PDF"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        cursor: loading ? 'default' : 'pointer',
        fontSize: 11,
        color: 'var(--text-secondary)',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <>Opening… <Download size={11} /></>
      ) : (
        <>PDF <Download size={11} /></>
      )}
    </button>
  );
}


// ── STUDY GUIDE COMPONENT ──────────────────────────────────────────────────────

function StudyGuideCard({ artifact }: { artifact: ParsedArtifact }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(59,130,246,0.1))',
        borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: 'var(--accent-purple)', borderRadius: 8, padding: 6, display: 'flex' }}>
            <BookOpen size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Study Guide</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{artifact.topic}{artifact.subject ? ` · ${artifact.subject}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyButton text={artifact.content} label="Copy" />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'study-guide'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'study-guide'} />
        <ExportButton text={artifact.content} filename={artifact.topic || 'study-guide'} />
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          {renderMarkdownBlock(artifact.content)}
        </div>
      )}
    </div>
  );
}

// ── PRACTICE TEST COMPONENT ────────────────────────────────────────────────────

function parseQuestions(content: string): ParsedQuestion[] {
  const questions: ParsedQuestion[] = [];
  const blocks = content.split(/\n---\n/);

  blocks.forEach((block, idx) => {
    if (!block.trim()) return;
    const lines = block.trim().split('\n');
    let text = '', options: string[] = [], answer = '', explanation = '', examRelevance = '';

    lines.forEach(line => {
      const l = line.trim();
      if (l.match(/^Q\d+\./)) text = l.replace(/^Q\d+\.\s*/, '');
      else if (l.match(/^\(A\)/)) options[0] = l.slice(3).trim();
      else if (l.match(/^\(B\)/)) options[1] = l.slice(3).trim();
      else if (l.match(/^\(C\)/)) options[2] = l.slice(3).trim();
      else if (l.match(/^\(D\)/)) options[3] = l.slice(3).trim();
      else if (l.startsWith('ANSWER:')) answer = l.replace('ANSWER:', '').trim();
      else if (l.startsWith('EXPLANATION:')) explanation = l.replace('EXPLANATION:', '').trim();
      else if (l.startsWith('EXAM_RELEVANCE:')) examRelevance = l.replace('EXAM_RELEVANCE:', '').trim();
    });

    if (text || options.length > 0) {
      questions.push({ number: idx + 1, text, options, answer, explanation, examRelevance });
    }
  });

  return questions;
}

function PracticeTestCard({ artifact }: { artifact: ParsedArtifact }) {
  const questions = parseQuestions(artifact.content);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});
  const [testComplete, setTestComplete] = useState(false);

  const question = questions[currentQ];
  const selected = selectedAnswers[currentQ];
  const showExp = showExplanations[currentQ];
  const isCorrect = selected === question?.answer;

  const score = Object.keys(selectedAnswers).filter(k => selectedAnswers[parseInt(k)] === questions[parseInt(k)]?.answer).length;

  const handleSelect = (option: string) => {
    if (selected) return;
    setSelectedAnswers(prev => ({ ...prev, [currentQ]: option }));
    setShowExplanations(prev => ({ ...prev, [currentQ]: true }));
  };

  const optionLabels = ['A', 'B', 'C', 'D'];

  if (!question) return null;

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
    }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(20,184,166,0.15), rgba(59,130,246,0.1))',
        borderBottom: '1px solid var(--border-subtle)', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#14b8a6', borderRadius: 8, padding: 6, display: 'flex' }}>
            <Zap size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Practice Test</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {artifact.topic} · {questions.length} questions
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: 6 }}>
            {Object.keys(selectedAnswers).length}/{questions.length} answered
          </div>
          {Object.keys(selectedAnswers).length === questions.length && (
            <div style={{ fontSize: 11, fontWeight: 700, color: score >= questions.length * 0.7 ? '#4ade80' : '#fb923c', background: score >= questions.length * 0.7 ? 'rgba(74,222,128,0.1)' : 'rgba(251,146,60,0.1)', padding: '3px 8px', borderRadius: 6 }}>
              {score}/{questions.length}
            </div>
          )}
          <CopyButton text={artifact.content} label="Copy" />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'practice-test'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'practice-test'} />
        <ExportButton text={artifact.content} filename={artifact.topic || 'practice-test'} />
        </div>
      </div>

      {/* Question Navigation */}
      <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {questions.map((_, i) => {
          const ans = selectedAnswers[i];
          const correct = ans === questions[i]?.answer;
          return (
            <button key={i} onClick={() => setCurrentQ(i)} style={{
              width: 28, height: 28, borderRadius: 6, fontSize: 11, fontWeight: 700,
              cursor: 'pointer', border: 'none',
              background: i === currentQ
                ? 'var(--accent-purple)'
                : ans ? (correct ? '#4ade80' : '#f87171') : 'var(--bg-tertiary)',
              color: i === currentQ || ans ? 'white' : 'var(--text-secondary)'
            }}>
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* Question Body */}
      <div style={{ padding: '20px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 16, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--accent-purple)', fontWeight: 800 }}>Q{question.number}. </span>
          {renderMarkdownInline(question.text)}
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {question.options.map((opt, i) => {
            const label = optionLabels[i];
            const isSelected = selected === label;
            const isAnswerKey = question.answer === label;
            let bg = 'var(--bg-secondary)', border = 'var(--border-subtle)', color = 'var(--text-secondary)';
            if (selected) {
              if (isAnswerKey) { bg = 'rgba(74,222,128,0.12)'; border = '#4ade80'; color = '#4ade80'; }
              else if (isSelected && !isAnswerKey) { bg = 'rgba(248,113,113,0.12)'; border = '#f87171'; color = '#f87171'; }
            } else if (isSelected) { bg = 'rgba(139,92,246,0.12)'; border = 'var(--accent-purple)'; color = 'var(--accent-purple)'; }

            return (
              <button key={i} onClick={() => handleSelect(label)} disabled={!!selected} style={{
                width: '100%', textAlign: 'left', padding: '10px 14px',
                background: bg, border: `1px solid ${border}`, borderRadius: 8,
                cursor: selected ? 'default' : 'pointer', color,
                display: 'flex', gap: 10, alignItems: 'flex-start',
                transition: 'all 0.15s'
              }}>
                <span style={{ fontWeight: 800, fontSize: 12, minWidth: 16, marginTop: 1 }}>{label}</span>
                <span style={{ fontSize: 13, lineHeight: 1.5 }}>{opt}</span>
                {selected && isAnswerKey && <CheckCircle size={14} style={{ marginLeft: 'auto', flexShrink: 0, marginTop: 2, color: '#4ade80' }} />}
                {selected && isSelected && !isAnswerKey && <XCircle size={14} style={{ marginLeft: 'auto', flexShrink: 0, marginTop: 2, color: '#f87171' }} />}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {showExp && question.explanation && (
          <div style={{
            background: isCorrect ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
            border: `1px solid ${isCorrect ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
            borderRadius: 8, padding: '12px 16px', marginBottom: 12
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: isCorrect ? '#4ade80' : '#f87171', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {isCorrect ? '✓ Correct' : '✗ Incorrect'} — Explanation
            </div>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>{question.explanation}</p>
            {question.examRelevance && (
              <p style={{ fontSize: 11, color: 'var(--accent-cyan)', marginTop: 8, marginBottom: 0, fontStyle: 'italic' }}>
                📋 {question.examRelevance}
              </p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button onClick={() => setCurrentQ(q => Math.max(0, q - 1))} disabled={currentQ === 0} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
            borderRadius: 6, cursor: currentQ === 0 ? 'not-allowed' : 'pointer',
            opacity: currentQ === 0 ? 0.4 : 1, fontSize: 12, color: 'var(--text-secondary)'
          }}>
            <ChevronLeft size={12} /> Prev
          </button>

          <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{currentQ + 1} / {questions.length}</span>

          <button onClick={() => setCurrentQ(q => Math.min(questions.length - 1, q + 1))} disabled={currentQ === questions.length - 1} style={{
            display: 'flex', alignItems: 'center', gap: 4, padding: '6px 12px',
            background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
            borderRadius: 6, cursor: currentQ === questions.length - 1 ? 'not-allowed' : 'pointer',
            opacity: currentQ === questions.length - 1 ? 0.4 : 1, fontSize: 12, color: 'var(--text-secondary)'
          }}>
            Next <ChevronRight size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── REVISION SHEET COMPONENT ───────────────────────────────────────────────────

function RevisionSheetCard({ artifact }: { artifact: ParsedArtifact }) {
  const [expanded, setExpanded] = useState(true);

  const sections = artifact.content.split(/\n(?=[⚡📐🔗⚠️🏆])/);

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(251,146,60,0.08))',
        borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#f59e0b', borderRadius: 8, padding: 6, display: 'flex' }}>
            <FileText size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Revision Sheet</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{artifact.topic}{artifact.subject ? ` · ${artifact.subject}` : ''}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyButton text={artifact.content} label="Copy" />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'revision-sheet'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'revision-sheet'} />
        <ExportButton text={artifact.content} filename={artifact.topic || 'revision-sheet'} />
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.length > 1 ? sections.map((section, i) => {
            if (!section.trim()) return null;
            const firstLine = section.split('\n')[0];
            const rest = section.split('\n').slice(1).join('\n');
            return (
              <div key={i} style={{ borderLeft: '3px solid var(--accent-purple)', paddingLeft: 14 }}>
                <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>{firstLine}</div>
                <div style={{ fontSize: 13 }}>{renderMarkdownBlock(rest)}</div>
              </div>
            );
          }) : renderMarkdownBlock(artifact.content)}
        </div>
      )}
    </div>
  );
}

// ── FLASHCARD SET COMPONENT ────────────────────────────────────────────────────

function parseFlashcards(content: string): ParsedFlashcard[] {
  const cards: ParsedFlashcard[] = [];
  const blocks = content.split(/\n---\n/);
  blocks.forEach((block, idx) => {
    if (!block.trim()) return;
    const lines = block.trim().split('\n');
    let front = '', back = '';
    lines.forEach(line => {
      if (line.startsWith('FRONT:')) front = line.replace('FRONT:', '').trim();
      if (line.startsWith('BACK:')) back = line.replace('BACK:', '').trim();
    });
    if (front) cards.push({ number: idx + 1, front, back });
  });
  return cards;
}

function FlashcardSetComponent({ artifact }: { artifact: ParsedArtifact }) {
  const cards = parseFlashcards(artifact.content);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<number>>(new Set());

  const card = cards[currentIdx];
  if (!card) return null;

  const handleRate = (knew: boolean) => {
    if (knew) setMastered(prev => new Set([...prev, currentIdx]));
    setFlipped(false);
    setTimeout(() => setCurrentIdx(i => (i + 1) % cards.length), 200);
  };

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.08))',
        borderBottom: '1px solid var(--border-subtle)', padding: '12px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#6366f1', borderRadius: 8, padding: 6, display: 'flex' }}>
            <Brain size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Flashcard Set</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {artifact.topic} · {cards.length} cards · {mastered.size} mastered
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ fontSize: 11, color: 'var(--text-tertiary)', background: 'var(--bg-tertiary)', padding: '3px 8px', borderRadius: 6 }}>
            {currentIdx + 1}/{cards.length}
          </div>
          <CopyButton text={artifact.content} label="Copy" />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'flashcards'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'flashcards'} />
        <ExportButton text={artifact.content} filename={artifact.topic || 'flashcards'} />        </div>
      </div>

      {/* Card */}
      <div style={{ padding: '24px 20px', minHeight: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '0.05em' }}>
          {flipped ? 'BACK — ANSWER' : 'FRONT — QUESTION'}
        </div>
        <div style={{
          width: '100%', minHeight: 80, background: 'var(--bg-secondary)',
          border: `1px solid ${flipped ? 'rgba(99,102,241,0.4)' : 'var(--border-subtle)'}`,
          borderRadius: 10, padding: '16px 20px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          textAlign: 'center', cursor: 'pointer',
          transition: 'all 0.2s',
          color: flipped ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontSize: 14, lineHeight: 1.6, fontWeight: flipped ? 400 : 500
        }} onClick={() => setFlipped(f => !f)}>
          {flipped ? renderMarkdownInline(card.back) : renderMarkdownInline(card.front)}
        </div>

        {!flipped ? (
          <button onClick={() => setFlipped(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
            background: 'var(--accent-purple)', color: 'white', border: 'none',
            borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700
          }}>
            <Eye size={13} /> Reveal Answer
          </button>
        ) : (
          <div style={{ display: 'flex', gap: 12 }}>
            <button onClick={() => handleRate(false)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.3)',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700
            }}>
              <RotateCcw size={12} /> Again
            </button>
            <button onClick={() => handleRate(true)} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '8px 20px',
              background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.3)',
              borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 700
            }}>
              <CheckCircle size={12} /> Got it
            </button>
          </div>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', gap: 5 }}>
          {cards.map((_, i) => (
            <div key={i} onClick={() => { setCurrentIdx(i); setFlipped(false); }} style={{
              width: 8, height: 8, borderRadius: '50%', cursor: 'pointer',
              background: mastered.has(i) ? '#4ade80' : i === currentIdx ? 'var(--accent-purple)' : 'var(--bg-tertiary)',
              border: i === currentIdx ? '2px solid var(--accent-purple)' : '1px solid var(--border-subtle)'
            }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── CONCEPT MAP COMPONENT ──────────────────────────────────────────────────────

function ConceptMapCard({ artifact }: { artifact: ParsedArtifact }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(20,184,166,0.12), rgba(59,130,246,0.08))',
        borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#14b8a6', borderRadius: 8, padding: 6, display: 'flex' }}>
            <Map size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Concept Map</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{artifact.topic}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyButton text={artifact.content} />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'concept-map'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'concept-map'} />
        <ExportButton text={artifact.content} filename={artifact.topic || 'concept-map'} />
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          <pre style={{
            fontFamily: 'var(--font-mono)', fontSize: 12,
            color: 'var(--text-secondary)', whiteSpace: 'pre-wrap',
            background: 'var(--bg-secondary)', borderRadius: 8, padding: '12px 16px',
            lineHeight: 1.8, margin: 0
          }}>
            {artifact.content}
          </pre>
        </div>
      )}
    </div>
  );
}

// ── STUDY PLAN COMPONENT ───────────────────────────────────────────────────────

function StudyPlanCard({ artifact }: { artifact: ParsedArtifact }) {
  const [expanded, setExpanded] = useState(true);
  const lines = artifact.content.split('\n').filter(l => l.trim());

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(236,72,153,0.12), rgba(139,92,246,0.08))',
        borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#ec4899', borderRadius: 8, padding: 6, display: 'flex' }}>
            <Calendar size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>Study Plan</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>
              {artifact.attributes.days ? `${artifact.attributes.days} days` : artifact.topic}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyButton text={artifact.content} />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'study-plan'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'study-plan'} />
        <ExportButton text={artifact.content} filename={artifact.topic || 'study-plan'} />
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
      </div>
      {expanded && (
        <div style={{ padding: '12px 20px' }}>
          {lines.map((line, i) => {
            const isDayLine = line.match(/^DAY \d+/);
            const isMeta = line.startsWith('TOTAL:') || line.startsWith('Priority');
            return (
              <div key={i} style={{
                padding: isDayLine ? '8px 12px' : '3px 12px',
                background: isDayLine ? 'var(--bg-secondary)' : 'transparent',
                borderRadius: isDayLine ? 6 : 0, marginBottom: isDayLine ? 4 : 0,
                borderLeft: isDayLine ? '3px solid var(--accent-purple)' : 'none',
                fontSize: isDayLine ? 12 : 11,
                fontWeight: isDayLine ? 700 : 400,
                color: isMeta ? 'var(--text-tertiary)' : isDayLine ? 'var(--text-primary)' : 'var(--text-secondary)',
                lineHeight: 1.5
              }}>
                {renderMarkdownInline(line)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── PDF CARD COMPONENT ─────────────────────────────────────────────────────────

function ExportButton({ text, filename = 'document' }: { text: string; filename?: string }) {
  const [loading, setLoading] = React.useState(false);
  const handleClick = () => {
    setLoading(true);
    downloadMarkdownAsPDF(text, filename);
    setTimeout(() => setLoading(false), 800);
  };
  return (
    <button
      onClick={handleClick}
      disabled={loading}
      title="Export as PDF"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        background: 'var(--bg-tertiary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 6,
        cursor: loading ? 'default' : 'pointer',
        fontSize: 11,
        color: 'var(--text-secondary)',
        transition: 'all 0.15s',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? <>
        Exporting… <Download size={11} />
      </> : <>
        Export PDF <Download size={11} />
      </>}
    </button>
  );
}

function PdfCard({ artifact }: { artifact: ParsedArtifact }) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
      borderRadius: 12, overflow: 'hidden', margin: '4px 0',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        background: 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.1))',
        borderBottom: expanded ? '1px solid var(--border-subtle)' : 'none',
        padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        cursor: 'pointer'
      }} onClick={() => setExpanded(!expanded)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ background: '#ef4444', borderRadius: 8, padding: 6, display: 'flex' }}>
            <FileText size={14} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text-primary)' }}>PDF Document</div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 1 }}>{artifact.topic}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <CopyButton text={artifact.content} label="Copy" />
          <DownloadMdButton text={artifact.content} filename={artifact.topic || 'document'} />
          <DownloadPdfButton text={artifact.content} filename={artifact.topic || 'document'} />
          {expanded ? <ChevronUp size={14} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={14} style={{ color: 'var(--text-tertiary)' }} />}
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '16px 20px' }}>
          {renderMarkdownBlock(artifact.content)}
        </div>
      )}
    </div>
  );
}

// ── MAIN EXPORT: FULL MESSAGE RENDERER ────────────────────────────────────────

interface RichMessageRendererProps {
  content: string;
  isStreaming?: boolean;
}

export function RichMessageRenderer({ content, isStreaming = false }: RichMessageRendererProps) {
  const parts = parseArtifacts(content);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {parts.map((part, i) => {
        if (part.type === 'text') {
          return (
            <div key={i} style={{ lineHeight: 1.65 }}>
              {renderMarkdownBlock(part.content)}
            </div>
          );
        }

        if (!part.artifact) return null;

        switch (part.artifact.type) {
          case 'study-guide': return <StudyGuideCard key={i} artifact={part.artifact} />;
          case 'practice-test': return <PracticeTestCard key={i} artifact={part.artifact} />;
          case 'revision-sheet': return <RevisionSheetCard key={i} artifact={part.artifact} />;
          case 'flashcard-set': return <FlashcardSetComponent key={i} artifact={part.artifact} />;
          case 'concept-map': return <ConceptMapCard key={i} artifact={part.artifact} />;
          case 'study-plan': return <StudyPlanCard key={i} artifact={part.artifact} />;
          case 'pdf': return <PdfCard key={i} artifact={part.artifact} />;
          default: return <div key={i}>{renderMarkdownBlock(part.content)}</div>;
        }
      })}

      {isStreaming && (
        <span style={{
          display: 'inline-block', width: 6, height: 14,
          background: 'var(--accent-purple)', borderRadius: 2, marginLeft: 2,
          verticalAlign: 'middle', animation: 'blink 1s step-end infinite'
        }} />
      )}
    </div>
  );
}
