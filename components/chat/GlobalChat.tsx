'use client';

import React, { useState, useEffect, useRef, memo, useCallback, useMemo } from 'react';
import { Bot, Maximize2, Minimize2, RefreshCw, Flame } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { useStream } from '@/hooks/useStream';
import { ChatInput } from './ChatInput';
import { RichMessageRenderer } from './RichMessageRenderer';
import { createClient } from '@/lib/supabase/client';
import { SessionClosingCard } from './SessionClosingCard';
import { useSessionTimer } from '@/hooks/useSessionTimer';
import { useRouter, useSearchParams } from 'next/navigation';
import { isAutopsyUploadIntent } from '@/lib/autopsy/upload-intent';
import { ThinkingIndicator } from './ThinkingIndicator';

import { AgentActivityFeed } from '@/components/amaura/AgentActivityFeed';

const MIND_QUICK_PROMPTS = [
  'What should I do now?',
  'Continue',
  'Create a goal',
  'Generate a quiz',
  'Autopsy a mistake',
  'Show weak areas',
  'Show source status',
];

const TUTOR_QUICK_PROMPTS = [
  'Explain current topic',
  'Ask diagnostic question',
  'Check my answer',
  'Repair weak area',
  'Review due memory',
  'Show source status',
];

const ChatMessage = memo(function ChatMessage({ msg }: { msg: any }) {
  const isUser = msg.role === 'user';
  const isClosingCard = msg.metadata?.action === 'session_closing_message';
  return (
    <div style={{
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
         <RichMessageRenderer content={msg.content} isStreaming={false} messageId={msg.id} metadata={msg.metadata} />
       )}
     </div>
   </div>
  );
});

function buildPracticeUpdateMessage(detail: any) {
  const metrics = detail?.metrics ?? {};
  const sync = detail?.profileSync ?? {};
  const wrongCount = Number(metrics.wrongCount ?? sync.wrongItems ?? 0);
  const correctCount = Number(metrics.correctCount ?? 0);
  const conceptNames = Array.isArray(metrics.wrongConceptNames) ? metrics.wrongConceptNames.filter(Boolean) : [];
  const focus = conceptNames.length > 0
    ? conceptNames.slice(0, 3).join(', ')
    : detail?.artifact?.topic || 'the missed concepts';

  if (sync.error) {
    return `I saved the attempt, but my learning-profile sync hit a problem: ${sync.message || sync.error}. I will retry from the event log, and you can submit again safely if the dashboard does not update.`;
  }

  if (wrongCount <= 0) {
    return `I logged this attempt: ${correctCount} correct and no new weak concepts. Your current plan stays steady.`;
  }

  const cards = Number(sync.cardsCreated ?? 0);
  const tasks = Number(sync.tasksCreated ?? 0);
  const mistakes = Number(sync.mistakesCreated ?? 0);
  const concepts = Number(sync.conceptsTouched ?? conceptNames.length);
  const planBits = [
    mistakes > 0 ? `${mistakes} mistake${mistakes === 1 ? '' : 's'}` : null,
    concepts > 0 ? `${concepts} weak concept${concepts === 1 ? '' : 's'}` : null,
    cards > 0 ? `${cards} due review card${cards === 1 ? '' : 's'}` : null,
    tasks > 0 ? `${tasks} next task${tasks === 1 ? '' : 's'}` : null,
  ].filter(Boolean).join(', ');

  return `I logged this attempt: ${correctCount} correct and ${wrongCount} missed. I updated ${planBits || 'your learner state'} and shifted your next study session toward ${focus}.`;
}

type GlobalChatProps = {
  endpoint?: string;
  tutorSurface?: boolean;
  titleSuffix?: string;
};

export const GlobalChat = memo(function GlobalChat({ endpoint = '/api/ai/chat', tutorSurface = false, titleSuffix = 'AI Tutor' }: GlobalChatProps) {
  const isAssistantOpen = useAppStore(s => s.isAssistantOpen);
  const toggleAssistant = useAppStore(s => s.toggleAssistant);
  const chatMessages = useAppStore(s => s.chatMessages);
  const addChatMessage = useAppStore(s => s.addChatMessage);
  const clearChat = useAppStore(s => s.clearChat);
  const activeGoalId = useAppStore(s => s.activeGoalId);
  const learningGoals = useAppStore(s => s.learningGoals);
  const streakDays = useAppStore(s => s.streakDays);
  const chatId = useAppStore(s => s.chatId);
  const loadChatFromSupabase = useAppStore(s => s.loadChatFromSupabase);
  const selectSession = useAppStore(s => (s as any).selectSession);
  const isAssistantExpanded = useAppStore(s => s.isAssistantExpanded);
  const toggleAssistantExpanded = useAppStore(s => s.toggleAssistantExpanded);
  const sessions = useAppStore(s => s.sessions);

  const activeGoal = useMemo(() => 
    learningGoals.find(goal => goal.id === activeGoalId) || null,
    [learningGoals, activeGoalId]
  );

  const [inputMessage, setInputMessage] = useState('');
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isProcessingUpload, setIsProcessingUpload] = useState(false);
  const [thinkingLabel, setThinkingLabel] = useState('Amaura is thinking');
  const [learningSignalSummary, setLearningSignalSummary] = useState<string | null>(null);
  const thinkingTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams?.get('sessionId');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize the stream hook
  const { status, streamingText, send, resetStatus } = useStream(endpoint);

  const hasMessages = chatMessages.length > 0;
  const { formatted } = useSessionTimer(hasMessages);

  const [user, setUser] = useState<any>(null);
  const [supabase] = useState(() => createClient());

  // Fetch authenticated user on mount
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUser(user);
    });
  }, [supabase]);

  // Load chat history when user is available
  useEffect(() => {
    if (!user) return;
    if (urlSessionId && urlSessionId !== chatId) {
      selectSession(urlSessionId);
    } else if (!chatId && !activeGoalId && !urlSessionId) {
      loadChatFromSupabase();
    }
  }, [user, chatId, activeGoalId, loadChatFromSupabase, selectSession, urlSessionId]);

  // Listen for goal context refresh events (e.g. source ready)
  useEffect(() => {
    const handleContextRefresh = () => {
      if (activeGoalId) {
        useAppStore.getState().loadGoalContext(activeGoalId);
      }
    };
    window.addEventListener('refresh-goal-context', handleContextRefresh);
    return () => window.removeEventListener('refresh-goal-context', handleContextRefresh);
  }, [activeGoalId]);

  useEffect(() => {
    const handleLearningProfileUpdated = async (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {};
      const state = useAppStore.getState();
      const goalId = detail.goalId ?? state.activeGoalId;

      await Promise.allSettled([
        state.loadLearningGoals(),
        goalId ? state.loadGoalContext(goalId) : Promise.resolve(null),
      ]);
      state.loadDashboardForActiveGoal();

      const wrongCount = Number(detail?.metrics?.wrongCount ?? detail?.profileSync?.wrongItems ?? 0);
      const correctCount = Number(detail?.metrics?.correctCount ?? 0);
      const total = correctCount + wrongCount;
      const weakConceptNames = Array.isArray(detail?.metrics?.wrongConceptNames)
        ? detail.metrics.wrongConceptNames.filter(Boolean)
        : [];
      if (total > 0) {
        setLearningSignalSummary(
          weakConceptNames.length > 0
            ? `Quiz submitted: ${correctCount}/${total}. Weak area: ${weakConceptNames[0]}.`
            : `Quiz submitted: ${correctCount}/${total}. No weak area flagged.`
        );
      }
      if (wrongCount > 0 || detail?.profileSync?.error) {
        addChatMessage({
          role: 'assistant',
          content: buildPracticeUpdateMessage(detail),
          timestamp: new Date().toISOString(),
          metadata: {
            action: 'planner_adjusted',
            profileSync: detail.profileSync,
          },
        });
      }
    };

    window.addEventListener('learning-profile-updated', handleLearningProfileUpdated);
    return () => window.removeEventListener('learning-profile-updated', handleLearningProfileUpdated);
  }, [addChatMessage]);

  const lastScrollTimeRef = useRef(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom utility
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    if (!messagesEndRef.current) return;
    
    // If streaming, throttle scroll to 300ms to prevent jitter
    if (status === 'streaming') {
      const now = Date.now();
      if (now - lastScrollTimeRef.current < 300) return;
      lastScrollTimeRef.current = now;
    }
    
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior, block: 'end' });
    });
  }, [status]);

  useEffect(() => {
    // Check if user is near bottom before auto-scrolling
    const container = scrollContainerRef.current;
    if (container && status === 'streaming') {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 120;
      if (isNearBottom) {
        scrollToBottom('auto');
      }
    } else {
      scrollToBottom('smooth');
    }
  }, [chatMessages.length, streamingText, isAssistantOpen, status, scrollToBottom]);

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
    let textToSend = typeof overrideMessage === 'string' ? overrideMessage : inputMessage.trim();
    if (!textToSend && !pendingFile) return;
    if (status === 'streaming' || status === 'connecting' || isProcessingUpload) return;

    // Special handling for 'Create a goal' quick action
    if (textToSend === 'Create a goal') {
      addChatMessage({
        role: 'user',
        content: textToSend,
        timestamp: new Date().toISOString(),
      });
      setTimeout(() => {
        addChatMessage({
          role: 'assistant',
          content: 'What specific learning goal should I create? For example: "mechanical properties of fluids", "solutions", or "NEET physics revision".',
          timestamp: new Date().toISOString(),
        });
      }, 400);
      setInputMessage('');
      return;
    }

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
    setThinkingLabel('MIND observing learning signal');
    window.dispatchEvent(new Event('amaura:agent-start'));

    thinkingTimersRef.current.forEach(clearTimeout);
    thinkingTimersRef.current = [
      setTimeout(() => setThinkingLabel('Amaura analyzing'), 1500),
      setTimeout(() => setThinkingLabel('Building answer'), 5000),
    ];

    const sessionTurnsCount = chatMessages.filter(m => m.role === 'user').length;

    // Call the streaming engine
    try {
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
          selectedMaterialIds: useAppStore.getState().selectedMaterialIds,
          tutorSurface,
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
      let content = 'I could not generate that part right now. Try again in a moment.';
      const backendMessage = e?.message?.replace(/^HTTP \d+: /, '');

      if (status === 400) content = backendMessage || 'I could not read that message. Please try again.';
      else if (status === 401) content = backendMessage || 'Your session has expired. Please log in again.';
      else if (status === 429) content = backendMessage || 'You are sending messages too quickly. Please slow down.';
      else if (status === 413) content = backendMessage || 'The attached file is too large.';
      else if (status >= 500) content = 'I could not generate that part right now. Try again in a moment.';
      else if (backendMessage && backendMessage !== 'Failed to fetch' && !/(api failed|nvidia|openai|anthropic|google|stack|404 page|http \d+)/i.test(backendMessage)) content = backendMessage;

      addChatMessage({
        role: 'assistant',
        content,
        timestamp: new Date().toISOString(),
      });
    } finally {
      thinkingTimersRef.current.forEach(clearTimeout);
      thinkingTimersRef.current = [];
      setThinkingLabel('Amaura is thinking');
      window.dispatchEvent(new Event('amaura:agent-stop'));
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
    tutorSurface,
  ]);

  const contextLine = useMemo(() => {
    if (!activeGoal) return 'General assistant · Create a goal to activate Amaura.';

    const c = activeGoal.counts;
    if (learningSignalSummary) {
      return `Context: ${activeGoal.title} · ${learningSignalSummary}`;
    }

    const sessionSignals = chatMessages.filter(m => m.role === 'user').length;
    const hasEvidence = (c?.sourcesReady || 0) > 0 || (c?.dueCards || 0) > 0 || (c?.weakConcepts || 0) > 0 || (c?.recentMistakes || 0) > 0;

    if (!hasEvidence && (c?.sourcesProcessing || 0) === 0) {
      if (sessionSignals > 0) {
        return `Context: ${activeGoal.title} · ${sessionSignals} learning signal${sessionSignals === 1 ? '' : 's'} captured from this session.`;
      }
      return `Context: ${activeGoal.title} · No learning signals yet. Ask a doubt or start today's mission.`;
    }

    const stateBits = [
      (c?.weakConcepts || 0) > 0 ? `${c?.weakConcepts} weak area${c?.weakConcepts === 1 ? '' : 's'}` : null,
      (c?.dueCards || 0) > 0 ? `${c?.dueCards} due card${c?.dueCards === 1 ? '' : 's'}` : null,
      (c?.recentMistakes || 0) > 0 ? `${c?.recentMistakes} mistake${c?.recentMistakes === 1 ? '' : 's'}` : null,
      (c?.sourcesReady || 0) > 0 ? `${c?.sourcesReady} source${c?.sourcesReady === 1 ? '' : 's'} ready` : null,
      (c?.sourcesProcessing || 0) > 0 ? `${c?.sourcesProcessing} processing` : null,
    ].filter(Boolean);

    return `Context: ${activeGoal.title} · ${stateBits.join(' · ')}.`;
  }, [activeGoal, chatMessages, learningSignalSummary]);

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
              <h3 style={{ fontSize: '14px', fontWeight: 'var(--fw-semibold)', margin: 0, letterSpacing: 0 }}>
                {activeGoal ? `${activeGoal.title} ${titleSuffix}` : (sessions.find((s: any) => s.id === chatId)?.title || titleSuffix)}
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
                  : contextLine}
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
      <div 
        ref={scrollContainerRef}
        style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        scrollBehavior: 'smooth'
      }}>
         {chatMessages.map((msg, idx) => (
           <ChatMessage key={msg.id || idx} msg={msg} />
         ))}

        {/* Live Streaming Message Bubble */}
        {(status === 'streaming' || status === 'connecting') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {status === 'connecting' && (
              <ThinkingIndicator label={thinkingLabel} />
            )}
            {streamingText && (
               <div style={{
                 maxWidth: '100%',
                 background: 'transparent',
                 border: 'none',
                 borderLeft: '2px solid rgba(124, 102, 255, 0.3)',
                 color: 'var(--text-primary)',
                 fontSize: '14px',
                 lineHeight: 'var(--lh-relaxed)',
                 wordBreak: 'break-word',
                 width: '100%',
                 padding: '8px 0 8px 16px',
                 fontFamily: 'var(--font-sans)'
               }}>
                <RichMessageRenderer content={streamingText} isStreaming={true} />
              </div>
            )}
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
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {(tutorSurface ? TUTOR_QUICK_PROMPTS : MIND_QUICK_PROMPTS).map((prompt) => (
            <button
              key={prompt}
              onClick={() => handleSendMessage(prompt)}
              disabled={status === 'streaming' || status === 'connecting' || isProcessingUpload}
              style={{
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-secondary)',
                color: 'var(--text-secondary)',
                borderRadius: 6,
                padding: '5px 7px',
                cursor: 'pointer',
                fontSize: '10px',
              }}
            >
              {prompt}
            </button>
          ))}
        </div>
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
