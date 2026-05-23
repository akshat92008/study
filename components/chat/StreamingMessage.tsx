'use client';

/**
 * StreamingMessage — renders a single AI response bubble.
 *
 * During streaming it shows a soft typing cursor. Text is rendered via
 * RichMessageRenderer so markdown, code blocks, and LaTeX work live.
 * Layout is stable (no shifts) because the bubble has `min-height` set
 * from the first token and grows downward only.
 */

import React, { memo, useEffect, useRef } from 'react';
import { RichMessageRenderer } from './RichMessageRenderer';

interface StreamingMessageProps {
  content: string;
  isStreaming: boolean;
  isError?: boolean;
}

export const StreamingMessage = memo(function StreamingMessage({
  content,
  isStreaming,
  isError = false,
}: StreamingMessageProps) {
  // Keep a stable height ref so the bubble never shrinks mid-stream
  const bubbleRef = useRef<HTMLDivElement>(null);

  // Scroll the cursor into view on every new chunk — lightweight, no layout thrash
  const cursorRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (isStreaming) {
      cursorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [content, isStreaming]);

  return (
    <div
      ref={bubbleRef}
      style={{
        maxWidth: '92%',
        padding: '12px 16px',
        borderRadius: '2px 16px 16px 16px',
        background: isError
          ? 'rgba(245,158,11,0.06)'
          : 'var(--bg-primary)',
        border: isError
          ? '1px solid rgba(245,158,11,0.25)'
          : '1px solid var(--border-subtle)',
        fontSize: 13,
        lineHeight: 1.65,
        wordBreak: 'break-word',
        position: 'relative',
        /* Prevent layout shift: guarantee stable min-height from first token */
        minHeight: 36,
        transition: 'border-color 80ms ease',
        ...(isStreaming && {
          borderColor: 'var(--accent-purple-dim)',
        }),
      }}
    >
      {content ? (
        <>
          <RichMessageRenderer content={content} isStreaming={isStreaming} />
          {isStreaming && (
            <span
              ref={cursorRef}
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 2,
                height: '1em',
                background: 'var(--accent-purple)',
                marginLeft: 2,
                verticalAlign: 'text-bottom',
                borderRadius: 1,
                animation: 'blink 0.9s step-end infinite',
              }}
            />
          )}
        </>
      ) : (
        /* Thinking indicator — shown before first token arrives */
        <ThinkingDots />
      )}
    </div>
  );
});

// ── Thinking animation — three bouncing dots ──────────────────────────────
function ThinkingDots() {
  return (
    <div
      aria-label="Cognition is thinking"
      style={{ display: 'flex', gap: 5, alignItems: 'center', height: 20 }}
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: 'var(--accent-purple)',
            opacity: 0.7,
            animation: `thinkBounce 1.2s ease-in-out ${i * 0.18}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes thinkBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
          40%            { transform: translateY(-5px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
