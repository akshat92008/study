'use client';

import React, { useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Send, Paperclip, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import { usePulseCollector } from '@/hooks/usePulseCollector';

export interface ChatInputProps {
  value: string;
  onChange: (val: string) => void;
  onSend: () => void;
  isStreaming: boolean;
  isProcessingUpload: boolean;
  onAttachFile: (file: File) => void;
  onClearPendingFile: () => void;
  pendingFile: File | null;
  placeholder?: string;
}

const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic'];

export function ChatInput({
  value,
  onChange,
  onSend,
  isStreaming,
  isProcessingUpload,
  onAttachFile,
  onClearPendingFile,
  pendingFile,
  placeholder = 'Ask anything...',
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { recordKeystroke, recordMessageSent } = usePulseCollector();
  const sendStartTime = useRef<number>(Date.now());

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = 'auto'; // reset
      const newHeight = Math.min(el.scrollHeight, 200); // max height 200px
      el.style.height = `${newHeight}px`;
    }
  }, [value]);

  // Duplicate handleSend removed – single implementation retained below.

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || pendingFile) {
        if (!isStreaming && !isProcessingUpload) {
          sendStartTime.current = Date.now();
          handleSend();
        }
      }
    }
  };

  const handleSend = () => {
    const messageLength = value.trim().length;
    onSend();
    setTimeout(() => {
      recordMessageSent(messageLength, Date.now() - sendStartTime.current);
    }, 100);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onAttachFile(file);
      // Reset input so the same file can be selected again
      e.target.value = '';
    }
  };

  const isSubmitDisabled = (!value.trim() && !pendingFile) || isStreaming || isProcessingUpload;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
      {pendingFile && (
        <div style={{
          background: 'var(--bg-tertiary)', border: '1px solid var(--accent-purple-dim)',
          borderRadius: 'var(--radius-md)', padding: 'var(--sp-2) var(--sp-3)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          maxWidth: 'max-content'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {IMAGE_MIME_TYPES.includes(pendingFile.type)
              ? <ImageIcon size={14} style={{ color: 'var(--accent-cyan)' }} />
              : <Paperclip size={14} style={{ color: 'var(--accent-purple)' }} />
            }
            <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'bold', color: 'var(--text-primary)' }}>{pendingFile.name}</span>
            <span style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>({(pendingFile.size / 1024).toFixed(1)} KB)</span>
          </div>
          <button
            type="button"
            onClick={onClearPendingFile}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer', padding: 4, display: 'flex' }}
            disabled={isStreaming || isProcessingUpload}
          >
            <X size={14} />
          </button>
        </div>
      )}

      <div style={{
        display: 'flex', alignItems: 'flex-end', background: 'var(--bg-primary)',
        border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)', padding: '6px 10px',
        transition: 'border-color var(--duration-fast)',
      }}
        onFocusCapture={e => e.currentTarget.style.borderColor = 'var(--accent-purple)'}
        onBlurCapture={e => e.currentTarget.style.borderColor = 'var(--border-strong)'}
      >
        <input
          type="file"
          ref={fileInputRef}
          accept=".pdf,.txt,.md,image/*"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isStreaming || isProcessingUpload}
          style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)',
            cursor: 'pointer', padding: 'var(--sp-2)', display: 'flex', alignItems: 'center'
          }}
          title="Attach file"
        >
          <Paperclip size={16} />
        </button>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { onChange(e.target.value); recordKeystroke(); }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={isProcessingUpload}
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: 'var(--text-primary)', fontSize: '13px', resize: 'none',
            padding: 'var(--sp-2) var(--sp-1)', fontFamily: 'var(--font-sans)',
            maxHeight: 200, lineHeight: 1.5,
          }}
          rows={1}
        />

        <button
          type="button"
          onClick={handleSend}
          disabled={isSubmitDisabled}
          style={{
            background: isSubmitDisabled ? 'var(--bg-tertiary)' : 'var(--accent-purple)',
            color: isSubmitDisabled ? 'var(--text-tertiary)' : 'white',
            border: 'none', borderRadius: 'var(--radius-sm)', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            transition: 'all var(--duration-fast)', padding: 0, margin: '4px'
          }}

        >
          {isProcessingUpload ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Send size={14} style={{ marginLeft: 2 }} />
          )}
        </button>
      </div>
    </div>
  );
}
