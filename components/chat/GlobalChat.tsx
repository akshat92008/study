'use client';

import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { Bot, Maximize2, Minimize2, RefreshCw, Flame } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useStream } from '@/hooks/useStream';
import { ChatInput } from './ChatInput';
import { RichMessageRenderer } from './RichMessageRenderer';
import { createClient } from '@/lib/supabase/client';
import { SessionClosingCard } from './SessionClosingCard';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useRouter } from 'next/navigation';
import { isAutopsyUploadIntent } from '@/lib/autopsy/upload-intent';

export const GlobalChat = memo(function GlobalChat() {
  const {
    isAssistantOpen,
    toggleAssistant,
    chatMessages,
    addChatMessage,
    clearChat,
    activeGoalId,
    streakDays,
    chatId,
    loadChatFromSupabase,
    isAssistantExpanded,
    toggleAssistantExpanded,
  } = useAppStore();

  const [inputMessage, setInputMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const router = useRouter();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize the stream hook
  const { status, streamingText, send, resetStatus } = useStream('/api/ai/chat');

  const hasMessages = chatMessages.length > 0;
  const { formatted } = useSessionTimer(hasMessages);

  const [user, setUser] = useState<any>(null);
  const supabaseRef = useRef(createClient());
  const supabase = supabaseRef.current;

  // Fetch authenticated user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, [supabase]);

  // Load chat history when user is available
  useEffect(() => {
    if (!user) return;
    loadChatFromSupabase();
  }, [loadChatFromSupabase, user]);

  // Scroll to bottom utility
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamingText, isAssistantOpen]);

  // Convert file to base64
  const fileToBase64 = useCallback((file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = error => reject(error);
    });
  }, []);

  const inferMimeType = useCallback((file: File): string => {
    if (file.type) return file.type;
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.pdf')) return 'application/pdf';
    if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown';
    if (lower.endsWith('.txt')) return 'text/plain';
    return 'application/octet-stream';
  }, []);

  const handleSendMessage = useCallback(async (overrideMessage?: string) => {
    const textToSend = typeof overrideMessage === 'string' ? overrideMessage : inputMessage.trim();
    if (!textToSend && !pendingFile) return;
    if (status === 'streaming' || status === 'connecting' || isProcessingUpload) return;

    let imageBase64: string | null = null;
    let imageMimeType: string | null = null;
    let documentBase64: string | null = null;
    let documentMimeType: string | null = null;
    let extractedText = '';
    let uploadedFileName: string | null = null;

    if (pendingFile) {
      uploadedFileName = pendingFile.name;
      const pendingMimeType = inferMimeType(pendingFile);
      const shouldRouteToAutopsy = isAutopsyUploadIntent(textToSend, pendingFile.name);

      if (shouldRouteToAutopsy) {
        setIsProcessingUpload(true);
        try {
          const b64 = await fileToBase64(pendingFile);
          const payload = b64.split(',')[1];
          if (pendingMimeType.startsWith('image/')) {
            imageBase64 = payload;
            imageMimeType = pendingMimeType;
          } else {
            documentBase64 = payload;
            documentMimeType = pendingMimeType;
          }
        } catch (e) {
          console.error('Failed to parse upload', e);
        }
        setIsProcessingUpload(false);
      } else if (pendingMimeType.startsWith('image/')) {
        setIsProcessingUpload(true);
        try {
          const b64 = await fileToBase64(pendingFile);
          imageBase64 = b64.split(',')[1];
          imageMimeType = pendingMimeType;
        } catch (e) {
          console.error('Failed to parse image', e);
        }
        setIsProcessingUpload(false);
      } else if (pendingMimeType.startsWith('text/')) {
        extractedText = await pendingFile.text();
      } else if (pendingMimeType === 'application/pdf') {
        setIsProcessingUpload(true);
        try {
          const b64 = await fileToBase64(pendingFile);
          documentBase64 = b64.split(',')[1];
          documentMimeType = pendingMimeType;
        } catch (e) {
          console.error('Failed to parse PDF', e);
        }
        setIsProcessingUpload(false);
      } else {
        // Unsupported file type – clear it
        setPendingFile(null);
      }
    }

    // Build message content
    const content = textToSend
      || (imageBase64 ? `[Uploaded image: ${uploadedFileName}]` : extractedText)
      || (documentBase64 ? `[Uploaded document: ${uploadedFileName}]` : '');
    
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

    const sessionTurnsCount = chatMessages.filter(m => m.role === 'user').length;

    // Call the streaming engine
    try {
      const requestBody: Record<string, unknown> = {
        message: content,
        history: chatMessages.slice(-10),
        sessionTurnsCount: sessionTurnsCount + 1,
      };

      if (imageBase64) requestBody.imageBase64 = imageBase64;
      if (imageMimeType) requestBody.imageMimeType = imageMimeType;
      if (activeGoalId) requestBody.activeGoalId = activeGoalId;
      if (chatId) requestBody.chatId = chatId;

      const result = await send({
        headers: {
          'Idempotency-Key': crypto.randomUUID(),
        },
        body: {
          message: content,
          history: chatMessages.slice(-10),
          sessionTurnsCount: sessionTurnsCount + 1,
          imageBase64,
          imageMimeType,
          documentBase64,
          documentMimeType,
          activeGoalId,
          chatId,
        }
      });

      if (result) {
        // Commit the final streamed text to the store
        addChatMessage({
          role: 'assistant',
          content: result.text,
          timestamp: new Date().toISOString(),
          metadata: result.toolCall ?? undefined,
        });
        
        // Trigger UI based on toolCall action
        if (result.toolCall?.action) {
          // Access store actions
          const { setActiveDrawer } = useAppStore.getState();
          // Simple mapping – can be extended
          if (result.toolCall.action === 'show_revision' || result.toolCall.action === 'show_flashcards') {
            setActiveDrawer('revision');
          } else if (result.toolCall.action === 'show_atlas') {
            setActiveDrawer('cognition');
          } else if (result.toolCall.action === 'run_autopsy') {
            setActiveDrawer('autopsy');
          } else if (result.toolCall.action === 'show_analytics') {
            router.push('/dashboard');
            window.dispatchEvent(new Event('refresh-dashboard'));
          } else if (result.toolCall.action === 'planner_adjusted') {
            window.dispatchEvent(new Event('refresh-dashboard'));
          }
        }
      }
    } catch (e: any) {
      console.error('Stream failed to complete', e);
      const status = e?.status;
      let content = 'Something went wrong. Please try again.';
      if (status === 400) content = 'I could not read that message. Please try again.';
      else if (status === 401) content = 'Your session has expired. Please log in again.';
      else if (status === 429) content = 'You are sending messages too quickly. Please slow down.';
      else if (status === 413) content = 'The attached file is too large.';
      else if (status >= 500) content = `I encountered an internal server error (HTTP ${status}). Please try again.`;

      addChatMessage({
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      });
    }
  }, [
    activeGoalId,
    addChatMessage,
    chatId,
    chatMessages,
    fileToBase64,
    inferMimeType,
    inputMessage,
    isProcessingUpload,
    pendingFile,
    resetStatus,
    router,
    send,
    status,
  ]);

   return (
     <div
       style={{
         position: 'relative',
         width: '100%',
         height: '100%',
          background: 'var(--bg-elevated)',
          border: 'none',
          borderRadius: '0',
          boxShadow: 'none',
          display: 'flex',
         flexDirection: 'column',
         zIndex: 1,
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
                MIND
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
                {status === 'streaming' || status === 'connecting'
                  ? 'Loading mission and learner state...'
                  : 'Using Today, Progress, Revision, and Test Analysis'}
              </span>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {hasMessages && (
            <span style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontFamily: 'monospace', marginRight: '8px' }}>
              {formatted()}
            </span>
          )}
          <button
            onClick={() => clearChat()}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              padding: '6px', cursor: 'pointer', borderRadius: '4px'
            }}
            title="Reload Chat"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={toggleAssistantExpanded}
            style={{
              background: 'transparent', border: 'none', color: 'var(--text-tertiary)',
              padding: '6px', cursor: 'pointer', borderRadius: '4px'
            }}
            title={isAssistantExpanded ? "Minimize Chat" : "Expand Chat"}
          >
            {isAssistantExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
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
                 maxWidth: isUser ? '85%' : '100%',
                 background: isUser ? '#8B5CF6' : 'transparent',
                 border: isUser ? 'none' : 'none',
                 borderLeft: (!isUser && !isClosingCard) ? '2px solid rgba(124, 102, 255, 0.3)' : 'none',
                 color: isUser ? 'white' : 'var(--text-primary)',
                 fontSize: '14px',
                 lineHeight: 'var(--lh-relaxed)',
                 wordBreak: 'break-word',
                 width: isClosingCard ? '100%' : (isUser ? 'fit-content' : '100%'),
                 animation: 'messageIn var(--duration-normal) var(--ease-out) forwards',
                 opacity: 0,
                 padding: isUser ? '12px 18px' : '8px 0 8px 16px',
                 borderRadius: isUser ? '20px' : '0',
                 boxShadow: isUser ? 'var(--shadow-sm)' : 'none',
                 fontFamily: 'var(--font-sans)'
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
                  <RichMessageRenderer content={msg.content} isStreaming={false} />
                )}
              </div>
            </div>
          );
        })}

        {/* Live Streaming Message Bubble */}
        {(status === 'streaming' || status === 'connecting') && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 16px' }}>
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px 20px',
        background: 'linear-gradient(to top, var(--bg-root) 60%, transparent)',
        position: 'relative',
        zIndex: 10,
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
