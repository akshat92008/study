'use client';

import React, { useRef, useEffect, useState, KeyboardEvent, ChangeEvent } from 'react';
import { Send, Paperclip, X, Image as ImageIcon, Loader2, Mic, MicOff } from 'lucide-react';

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

  const [isListening, setIsListening] = useState(false);
  const [isSpeechAvailable, setIsSpeechAvailable] = useState(false);
  const recognitionRef = useRef<any>(null);
  const originalValueRef = useRef('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          let fullTranscript = '';
          for (let i = 0; i < event.results.length; i++) {
            fullTranscript += event.results[i][0].transcript;
          }
          onChange(originalValueRef.current + (originalValueRef.current ? ' ' : '') + fullTranscript);
        };
        recognition.onerror = (event: any) => {
          console.error('Speech recognition error', event.error);
          setIsListening(false);
        };
        recognition.onend = () => {
          setIsListening(false);
        };
        recognitionRef.current = recognition;
        setIsSpeechAvailable(true);
      } else {
        setIsSpeechAvailable(false);
      }
    }
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [onChange]);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      originalValueRef.current = value;
      try {
        recognitionRef.current?.start();
        setIsListening(true);
      } catch (e) {
        console.error('Error starting speech recognition:', e);
      }
    }
  };

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
          handleSend();
        }
      }
    }
  };

  const handleSend = () => {
    // Validate pending image file before sending
    if (pendingFile) {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(pendingFile.type)) {
        console.error('Only JPEG, PNG, WebP, and GIF images are supported.');
        return;
      }
      if (pendingFile.size > 10 * 1024 * 1024) {
        console.error('Image must be under 10MB.');
        return;
      }
    }
    onSend();
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
        display: 'flex', alignItems: 'flex-end', 
        background: 'rgba(22, 24, 29, 0.6)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--border-default)', borderRadius: '24px', padding: '6px 12px',
        transition: 'all var(--duration-normal) var(--ease-out)',
        boxShadow: 'var(--shadow-md)',
      }}
        onFocusCapture={e => {
          e.currentTarget.style.borderColor = 'var(--border-focus)';
          e.currentTarget.style.boxShadow = 'var(--shadow-lg), var(--shadow-glow-purple)';
        }}
        onBlurCapture={e => {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.boxShadow = 'var(--shadow-md)';
        }}
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

        <button
          type="button"
          onClick={toggleListening}
          disabled={isProcessingUpload || !isSpeechAvailable}
          style={{
            background: 'transparent', border: 'none', color: isListening ? 'var(--danger)' : 'var(--text-secondary)',
            cursor: 'pointer', padding: 'var(--sp-2)', display: 'flex', alignItems: 'center',
            animation: isListening ? 'pulse-flame 1.5s infinite' : 'none'
          }}
          title={isListening ? 'Stop listening' : 'Start voice typing'}
        >
          {isListening ? <MicOff size={16} /> : <Mic size={16} />}
        </button>


        <textarea
          ref={textareaRef}
          value={value}
          onChange={e => { onChange(e.target.value); }}
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
            background: 'transparent',
            color: isSubmitDisabled ? 'var(--text-tertiary)' : 'var(--text-primary)',
            border: 'none', borderRadius: '50%', width: 32, height: 32,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: isSubmitDisabled ? 'not-allowed' : 'pointer',
            transition: 'all var(--duration-fast) var(--ease-out)', padding: 0, margin: '4px',
            transform: isSubmitDisabled ? 'scale(0.95)' : 'scale(1)',
          }}
          onMouseOver={(e) => {
            if (!isSubmitDisabled) {
              e.currentTarget.style.color = 'var(--accent-purple)';
              e.currentTarget.style.transform = 'scale(1.05)';
            }
          }}
          onMouseOut={(e) => {
            if (!isSubmitDisabled) {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.transform = 'scale(1)';
            }
          }}
        >
          {isProcessingUpload ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Send size={16} style={{ marginLeft: 2 }} />
          )}
        </button>
      </div>
    </div>
  );
}
