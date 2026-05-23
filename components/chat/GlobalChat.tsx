'use client';

import React, { useState, useEffect, useRef, memo } from 'react';
import { Bot, Maximize2, Minimize2, Trash2, Flame } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useStream } from '@/hooks/useStream';
import { StreamingMessage } from './StreamingMessage';
import { ChatInput } from './ChatInput';
import { RichMessageRenderer } from './RichMessageRenderer';
import { createClient } from '@/lib/supabase/client';
import DailySessionCard from './DailySessionCard';
import { SessionClosingCard } from './SessionClosingCard';

export const GlobalChat = memo(function GlobalChat() {
  const {
    isAssistantOpen,
    toggleAssistant,
    chatMessages,
    addChatMessage,
    clearChat,
    loadChatFromSupabase,
    activeGoalId,
    streakDays,
    setStreakDays,
    startSession,
    sessionStartTime,
  } = useAppStore();

  const [inputMessage, setInputMessage] = useState('');
  const [currentSessionTopic, setCurrentSessionTopic] = useState('');
  const [currentSessionSubject, setCurrentSessionSubject] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize the stream hook
  const { status, streamingText, send, cancel, resetStatus } = useStream('/api/ai/chat');

  // Load history on mount
  useEffect(() => {
    loadChatFromSupabase();
  }, [loadChatFromSupabase]);

  // Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamingText, isAssistantOpen]);

  // Handle session closing message -> update streak
  useEffect(() => {
    if (chatMessages.length === 0) return;
    const lastMsg = chatMessages[chatMessages.length - 1];
    if (lastMsg.role === 'assistant' && lastMsg.metadata?.action === 'session_closing_message') {
      if (lastMsg.metadata.sessionComplete && sessionStartTime) {
        const duration = Math.round((Date.now() - sessionStartTime) / 60000);
        fetch('/api/dashboard/session-close', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conceptName: currentSessionTopic,
            subject: currentSessionSubject,
            sessionDurationMinutes: duration
          })
        })
        .then(r => r.json())
        .then(data => {
          if (data.newStreak !== undefined) {
            setStreakDays(data.newStreak);
          }
        })
        .catch(console.error);
        
        useAppStore.getState().endSession();
      }
    }
  }, [chatMessages, sessionStartTime, currentSessionTopic, currentSessionSubject, setStreakDays]);

  // Convert file to base64
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  };

  const handleSendMessage = async (overrideMessage?: string) => {
    const textToSend = typeof overrideMessage === 'string' ? overrideMessage : inputMessage.trim();
    if (!textToSend && !pendingFile) return;
    if (status === 'streaming' || status === 'connecting' || isProcessingUpload) return;

    let imageBase64 = null;
    let imageMimeType = null;
    let extractedText = '';

    if (pendingFile) {
      if (pendingFile.type.startsWith('image/')) {
        setIsProcessingUpload(true);
        try {
          const b64 = await fileToBase64(pendingFile);
          imageBase64 = b64.split(',')[1];
          imageMimeType = pendingFile.type;
        } catch (e) {
          console.error('Failed to parse image', e);
        }
        setIsProcessingUpload(false);
      } else if (pendingFile.type === 'application/pdf' || pendingFile.type.startsWith('text/')) {
        // Process document through ingestion API
        setIsProcessingUpload(true);
        try {
          const form = new FormData();
          form.append('file', pendingFile);
          const resp = await fetch('/api/ingest', {
            method: 'POST',
            body: form,
          });
          const data = await resp.json();
          extractedText = data.text ?? '';
        } catch (e) {
          console.error('Failed to ingest document', e);
        }
        setIsProcessingUpload(false);
      } else {
        // Unsupported file type – clear it
        setPendingFile(null);
      }
    }

    // Build message content
    const content = textToSend
      || (imageBase64 ? `[Uploaded image: ${pendingFile?.name}]` : extractedText);
    
    // Optimistic UI - user message
    const userMsg = {
      role: 'user' as const,
      content,
      timestamp: new Date().toISOString(),
    };
    addChatMessage(userMsg);
    
    setInputMessage('');
    setPendingFile(null);
    resetStatus();

    // Call the streaming engine
    try {
      const result = await send({
        body: {
          message: content,
          history: chatMessages.slice(-10),
          imageBase64,
          imageMimeType,
          activeGoalId,
        }
      });

      if (result) {
        // Commit the final streamed text to the store
        addChatMessage({
          role: 'assistant',
          content: result.text,
          timestamp: new Date().toISOString(),
          metadata: result.toolCall ? { action: result.toolCall.action } : undefined,
        });
        // Trigger UI based on toolCall action
        if (result.toolCall?.action) {
          // Access store actions
          const { setActiveDrawer } = useAppStore.getState();
          // Simple mapping – can be extended
          if (result.toolCall.action === 'show_revision') {
            setActiveDrawer('revision');
          } else if (result.toolCall.action === 'show_atlas') {
            setActiveDrawer('cognition');
          }
        }
      }
    } catch (e) {
      console.error('Stream failed to complete', e);
      addChatMessage({
        role: 'assistant',
        content: 'I lost connection there. Please try again.',
        timestamp: new Date().toISOString(),
      });
    }
  };

  const handleInterrupt = () => {
    cancel();
    if (streamingText) {
      addChatMessage({
        role: 'assistant',
        content: streamingText + ' [Interrupted]',
        timestamp: new Date().toISOString(),
      });
    }
    resetStatus();
  };

  if (!isAssistantOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        width: isExpanded ? '600px' : '400px',
        height: isExpanded ? '80vh' : '600px',
        maxHeight: 'calc(100vh - 48px)',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-xl)',
        boxShadow: 'var(--shadow-lg), 0 0 40px hsla(265, 80%, 60%, 0.08)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 9999,
        transition: 'all var(--ease-spring) 400ms',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'var(--bg-glass)',
        backdropFilter: 'blur(10px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, var(--accent-purple-dim), var(--accent-blue-dim))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'inset 0 1px 1px hsla(220, 20%, 95%, 0.2)'
          }}>
            <Bot size={18} color="white" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 'var(--fw-semibold)', margin: 0, letterSpacing: '-0.01em' }}>
                Cognition OS
              </h3>
              {streakDays > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: '8px', padding: '2px 6px', background: 'rgba(251,146,60,0.12)', borderRadius: '12px', border: '1px solid rgba(251,146,60,0.25)' }}>
                  <Flame size={12} color="#fb923c" />
                  <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#fb923c' }}>{streakDays}</span>
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                display: 'inline-block', width: '6px', height: '6px',
                borderRadius: '50%', background: 'var(--success)',
                boxShadow: 'var(--shadow-glow-success)'
              }} />
              <span style={{ fontSize: '11px', color: 'var(--text-tertiary)', fontWeight: 'var(--fw-medium)' }}>
                {status === 'streaming' || status === 'connecting' ? 'Synthesizing...' : 'Online & synced'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <button
            onClick={() => clearChat()}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              padding: '6px', cursor: 'pointer', borderRadius: '4px'
            }}
            title="Clear Chat"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              padding: '6px', cursor: 'pointer', borderRadius: '4px'
            }}
          >
            {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={toggleAssistant}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              padding: '6px', cursor: 'pointer', borderRadius: '4px'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        scrollBehavior: 'smooth'
      }}>
        {chatMessages.length === 0 && (
          <DailySessionCard
            onStartSession={(topic, subject, estimatedMinutes) => {
              setCurrentSessionTopic(topic);
              setCurrentSessionSubject(subject);
              startSession();
              
              const prompt = `Let's start today's session. Topic: ${topic}, Subject: ${subject}.\nTeach me, test me, challenge me. I have ${estimatedMinutes} minutes.`;
              handleSendMessage(prompt);
            }}
          />
        )}
        {chatMessages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isClosingCard = msg.metadata?.action === 'session_closing_message';
          return (
            <div key={idx} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: isUser ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '92%',
                padding: isClosingCard ? '0' : '12px 16px',
                borderRadius: isUser ? '16px 16px 2px 16px' : '2px 16px 16px 16px',
                background: isUser ? 'var(--accent-purple)' : (isClosingCard ? 'transparent' : 'var(--bg-primary)'),
                border: isUser ? 'none' : (isClosingCard ? 'none' : '1px solid var(--border-subtle)'),
                color: isUser ? 'white' : 'var(--text-primary)',
                fontSize: '13px',
                lineHeight: 1.65,
                wordBreak: 'break-word',
                width: isClosingCard ? '100%' : 'auto',
              }}>
                {isClosingCard ? (
                  <SessionClosingCard
                    closingMessage={msg.metadata?.closingMessage || msg.content}
                    oldMastery={msg.metadata?.oldMastery}
                    newMastery={msg.metadata?.newMastery}
                    cardsCreated={msg.metadata?.cardsCreated}
                    tomorrowFocus={msg.metadata?.tomorrowFocus}
                  />
                ) : (
                  <RichMessageRenderer content={msg.content} isStreaming={false} isUser={isUser} />
                )}
              </div>
            </div>
          );
        })}

        {/* Live Streaming Message Bubble */}
        {(status === 'streaming' || status === 'connecting') && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
             <StreamingMessage
                content={streamingText}
                isStreaming={true}
             />
             <button
               onClick={handleInterrupt}
               style={{
                 marginTop: '8px', fontSize: '11px', background: 'transparent',
                 border: 'none', color: 'var(--text-tertiary)', cursor: 'pointer'
               }}
             >
               Stop generating
             </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-subtle)',
        background: 'var(--bg-secondary)',
      }}>
        <ChatInput
          value={inputMessage}
          onChange={setInputMessage}
          onSend={handleSendMessage}
          isStreaming={status === 'streaming' || status === 'connecting'}
          isProcessingUpload={isProcessingUpload}
          onAttachFile={setPendingFile}
          onClearPendingFile={() => setPendingFile(null)}
          pendingFile={pendingFile}
        />
        <div style={{
          textAlign: 'center', marginTop: '12px', fontSize: '10px',
          color: 'var(--text-tertiary)', fontWeight: 'var(--fw-medium)'
        }}>
          Cognition OS can make mistakes. Verify important academic concepts.
        </div>
      </div>
    </div>
  );
});
