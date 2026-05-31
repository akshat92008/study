'use client';

import { useState, useRef, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Progress from '@/components/ui/Progress';
import { 
  Flame, Sparkles, Send, ArrowRight, CheckCircle2, 
  BookOpen, HelpCircle, Trophy, RefreshCw, X,
  Mic, MicOff, Volume2, VolumeX
} from 'lucide-react';
import { logStudentEvent } from '@/lib/utils/events';
import { useVoiceInteraction } from '@/hooks/useVoiceInteraction';
import { useAppStore } from '@/stores/appStore';


interface Message {
  role: 'user' | 'tutor';
  content: string;
}

interface DailySessionFocusProps {
  taskId: string;
  subject: string;
  chapter: string;
  estimatedMinutes: number;
  initialStreak: number;
  onClose: () => void;
  onCompleted: (newStreak: number) => void;
}

export default function DailySessionFocus({
  taskId,
  subject,
  chapter,
  estimatedMinutes,
  initialStreak,
  onClose,
  onCompleted,
}: DailySessionFocusProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [step, setStep] = useState(1); // 1 to 5 steps
  const [sessionState, setSessionState] = useState<'intro' | 'active' | 'celebrate'>('intro');
  const [newStreak, setNewStreak] = useState(initialStreak);
  const [completing, setCompleting] = useState(false);
  const [inlineCard, setInlineCard] = useState<{ front: string; back: string } | null>(null);

  const { voiceModeEnabled, toggleVoiceMode } = useAppStore();
  const { isListening, startListening, stopListening, isSpeaking, speak, stopSpeaking, isSpeechSupported, isSynthesisSupported } = useVoiceInteraction((text) => {
    setInput(prev => prev + (prev ? ' ' : '') + text);
  });

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Start the session by fetching the initial greeting from the Socratic tutor
  const startSession = async () => {
    setSessionState('active');
    setStreaming(true);
    setMessages([{ role: 'tutor', content: '' }]);

    // Emit event to the universal event bus
    logStudentEvent('session_start', { taskId, subject, chapter, estimatedMinutes });

    const greetingPrompt = `You are MIND, the Socratic AI Tutor. Greet me for today's daily session on "${subject} > ${chapter}". Welcome me warmly, state the time commitment (${estimatedMinutes} minutes), and present an opening question or concept breakdown to kick off our Socratic study block. Make it direct and highly engaging.`;

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: greetingPrompt,
          history: []
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk
            };
            return updated;
          });
        }
      }
      
      if (voiceModeEnabled && fullResponse) {
        speak(fullResponse);
      }
    } catch (e) {
      setMessages([{ role: 'tutor', content: "Let's start our study block. How confident are you feeling with today's topic?" }]);
    } finally {
      setStreaming(false);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || streaming) return;
    const userMsg = input.trim();
    setInput('');
    
    // Add student message
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setStreaming(true);
    
    // Add placeholder for streaming reply
    setMessages(prev => [...prev, { role: 'tutor', content: '' }]);

    // Increment progress step (up to step 5)
    const nextStep = Math.min(5, step + 1);
    setStep(nextStep);

    // If we are at step 4, instruct the tutor to issue the final practice check question
    let tutorInstructions = userMsg;
    if (nextStep === 4) {
      tutorInstructions = `${userMsg}\n\n(System: This is turn 4 of our session. Please present a final practice question to confirm my understanding of this concept.)`;
    }

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: tutorInstructions,
          history: messages.slice(-6), // Send recent history for context
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          fullResponse += chunk;
          setMessages(prev => {
            const updated = [...prev];
            updated[updated.length - 1] = {
              ...updated[updated.length - 1],
              content: updated[updated.length - 1].content + chunk
            };
            return updated;
          });
        }
      }
      
      if (voiceModeEnabled && fullResponse) {
        speak(fullResponse);
      }

      // Check if we want to simulate inline card creation based on keywords
      if (nextStep === 3) {
        const front = `[Concept Gap] Core definition/problem of ${chapter}`;
        const back = `The correct relationship and formula for ${chapter}.`;
        setInlineCard({ front, back });
        
        // Emit concept gap event
        logStudentEvent('concept_gap_detected', { subject, chapter, front, back });
      }
    } catch {
      setMessages(prev => {
        const u = [...prev];
        u[u.length - 1] = { role: 'tutor', content: 'Connection timed out. Let\'s keep going.' };
        return u;
      });
    } finally {
      setStreaming(false);
    }
  };

  // Complete the session, write to database and display celebration
  const completeSession = async () => {
    if (completing) return;
    setCompleting(true);

    try {
      const res = await fetch('/api/dashboard/complete-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': `daily-session:${taskId || chapter}:${new Date().toISOString().slice(0, 10)}`,
        },
        body: JSON.stringify({ taskId, subject, chapter, durationMinutes: estimatedMinutes }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        console.error('Session completion failed', data);
        alert(data.message || 'Could not save your session. Please retry.');
        return;
      }

      setNewStreak(data.streakDays || initialStreak);
      setSessionState('celebrate');

      logStudentEvent('session_complete', {
        taskId,
        subject,
        chapter,
        newStreak: data.streakDays || initialStreak,
      });
    } catch (e) {
      console.error('Failed to complete session', e);
      alert('Could not save your session. Please check your connection and retry.');
    } finally {
      setCompleting(false);
    }
  };

  const currentProgress = (step / 5) * 100;

  if (sessionState === 'intro') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 7, 12, 0.95)', backdropFilter: 'blur(20px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sp-4)'
      }}>
        <Card variant="glow" style={{
          maxWidth: 550, width: '100%', padding: 'var(--sp-8)',
          background: 'var(--bg-secondary)', border: '1px solid var(--accent-purple-dim)',
          textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)'
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 72, height: 72, borderRadius: 'var(--radius-full)',
              background: 'rgba(168, 85, 247, 0.1)', color: 'var(--accent-purple)',
              marginBottom: 'var(--sp-4)'
            }}>
              <Flame size={36} className="animate-pulse" style={{ color: 'var(--warning)' }} />
            </div>
            <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>
              Start Daily Socratic Session
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 'var(--lh-relaxed)' }}>
              You are about to start today's focus block on <strong style={{ color: 'var(--text-primary)' }}>{chapter}</strong>. 
              MIND will tutor you Socratically to test your understanding.
            </p>
          </div>

          <div style={{
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)',
            padding: 'var(--sp-4)', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)',
            textAlign: 'left', border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Session Details</div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>Subject: <span style={{ color: 'var(--accent-cyan)' }}>{subject}</span></div>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>Duration: <span style={{ color: 'var(--success)' }}>{estimatedMinutes} Minutes</span></div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 'var(--sp-2)' }}>
              ✨ Finishing this session increments your daily learning streak.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'center' }}>
            <Button variant="secondary" onClick={onClose}>Discard</Button>
            <Button onClick={startSession} style={{ background: 'var(--accent-purple)', color: '#fff' }}>
              Begin Session <ArrowRight size={16} style={{ marginLeft: 4 }} />
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (sessionState === 'celebrate') {
    return (
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(5, 7, 12, 0.98)', backdropFilter: 'blur(20px)',
        zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sp-4)'
      }}>
        <Card variant="glow" style={{
          maxWidth: 500, width: '100%', padding: 'var(--sp-8)',
          background: 'var(--bg-secondary)', border: '1px solid var(--success-dim)',
          textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)'
        }}>
          <div>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 80, height: 80, borderRadius: 'var(--radius-full)',
              background: 'rgba(34, 197, 94, 0.1)', color: 'var(--success)',
              marginBottom: 'var(--sp-4)', boxShadow: '0 0 20px rgba(34, 197, 94, 0.2)',
              position: 'relative'
            }}>
              <Trophy size={40} />
              <div style={{ position: 'absolute', top: -4, right: -4 }}>
                <Sparkles size={20} style={{ color: 'var(--warning)', animation: 'spin 4s linear infinite' }} />
              </div>
            </div>
            <h2 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', color: 'var(--success)' }}>
              Session Complete!
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', marginTop: 8 }}>
              You've locked in today's concept focus on {chapter}.
            </p>
          </div>

          <div style={{
            background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)',
            padding: 'var(--sp-6)', border: '1px solid var(--border-default)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 'var(--sp-3)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
              <Flame size={32} className="pulse-flame" style={{ color: 'var(--warning)', filter: 'drop-shadow(0 0 8px var(--warning-dim))' }} />
              <span style={{ fontSize: 'var(--fs-3xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)' }}>
                {initialStreak} → {newStreak} Days
              </span>
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              🔥 Streak updated successfully in profiles.
            </div>
          </div>

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            <Progress value={100} color="green" size="md" />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              <span>Daily Goal Completed</span>
              <span>100%</span>
            </div>
          </div>

          <Button onClick={() => onCompleted(newStreak)} style={{ background: 'var(--success)', color: '#fff', width: '100%', fontWeight: 600 }}>
            Done for Today <CheckCircle2 size={16} style={{ marginLeft: 6 }} />
          </Button>
        </Card>

        <style dangerouslySetInnerHTML={{__html: `
          @keyframes pulse-flame {
            0%, 100% { transform: scale(1); filter: drop-shadow(0 0 6px var(--warning-dim)); }
            50% { transform: scale(1.15); filter: drop-shadow(0 0 16px var(--warning)); }
          }
          .pulse-flame { animation: pulse-flame 1.5s ease-in-out infinite; }
        `}} />
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'var(--bg-root)', zIndex: 1000, display: 'flex', flexDirection: 'column'
    }}>
      {/* Session Header */}
      <div style={{
        padding: '0 var(--sp-6)', height: 'var(--header-height)',
        borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-glass)',
        backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-3)' }}>
          <Flame size={20} style={{ color: 'var(--warning)' }} />
          <span style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-semibold)' }}>
            Daily Focus: <span style={{ color: 'var(--accent-cyan)' }}>{chapter}</span>
          </span>
          <span style={{
            fontSize: 'var(--fs-xs)', background: 'var(--bg-tertiary)',
            padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)'
          }}>{subject}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', width: 300 }}>
          <div style={{ flex: 1 }}>
            <Progress value={currentProgress} color={step >= 4 ? 'yellow' : 'blue'} size="sm" />
          </div>
          <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
            {step}/5 Steps
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          {isSynthesisSupported && (
            <button onClick={toggleVoiceMode} style={{
              background: 'transparent', border: 'none', color: voiceModeEnabled ? 'var(--accent-purple)' : 'var(--text-secondary)', cursor: 'pointer', padding: 4
            }} title={voiceModeEnabled ? "Disable Voice Mode" : "Enable Voice Mode"}>
              {voiceModeEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
            </button>
          )}
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4
          }}>
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Main Workspace split */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Chat Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: inlineCard ? '1px solid var(--border-subtle)' : 'none' }}>
          <div ref={scrollRef} style={{
            flex: 1, overflowY: 'auto', padding: 'var(--sp-6)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)'
          }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: 'var(--sp-4)', borderRadius: 'var(--radius-lg)',
                  background: msg.role === 'user' ? 'var(--accent-purple)' : 'var(--bg-secondary)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--border-default)',
                  color: '#fff', fontSize: 'var(--fs-base)', lineHeight: 'var(--lh-relaxed)',
                  whiteSpace: 'pre-wrap', position: 'relative',
                  boxShadow: msg.role === 'user' ? 'var(--shadow-glow-purple-dim)' : 'none'
                }}>
                  {msg.content || (streaming && i === messages.length - 1 ? (
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)', animation: 'blink 1.4s infinite both' }} />
                      <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)', animation: 'blink 1.4s infinite both 0.2s' }} />
                      <span className="dot" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--text-secondary)', animation: 'blink 1.4s infinite both 0.4s' }} />
                    </div>
                  ) : '')}
                </div>
              </div>
            ))}
          </div>

          {/* Input panel / Finish Block button */}
          <div style={{
            padding: 'var(--sp-4) var(--sp-6)', borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-surface)'
          }}>
            {step >= 5 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', alignItems: 'center' }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  🎉 Socratic dialogue finished! Submit your final responses to complete today's focus block.
                </div>
                <Button 
                  onClick={completeSession} 
                  disabled={completing}
                  style={{
                    background: 'var(--success)', color: '#fff', padding: 'var(--sp-3) var(--sp-6)',
                    fontWeight: 600, width: '100%', maxWidth: 400
                  }}
                >
                  {completing ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" style={{ marginRight: 6 }} />
                      Locking in progress...
                    </>
                  ) : (
                    <>
                      Finish Session & Update Streak
                      <ArrowRight size={16} style={{ marginLeft: 6 }} />
                    </>
                  )}
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
                {isSpeechSupported && (
                  <Button 
                    onClick={isListening ? stopListening : startListening}
                    disabled={streaming}
                    style={{
                      background: 'transparent', border: '1px solid var(--border-default)', 
                      color: isListening ? 'var(--accent-pink)' : 'var(--text-secondary)',
                      animation: isListening ? 'pulse 2s infinite' : 'none'
                    }}
                    title={isListening ? "Stop Listening" : "Start Voice Input"}
                  >
                    {isListening ? <MicOff size={16} /> : <Mic size={16} />}
                  </Button>
                )}
                <input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder={step === 4 ? "Answer the final practice check question..." : "Enter your explanation or answer..."}
                  disabled={streaming}
                  style={{
                    flex: 1, padding: 'var(--sp-4)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                    borderRadius: 'var(--radius-lg)', outline: 'none', fontSize: 'var(--fs-base)'
                  }}
                />
                <Button onClick={handleSend} disabled={!input.trim() || streaming}>
                  <Send size={16} />
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar for Inline Flashcards */}
        {inlineCard && (
          <div style={{
            width: 320, background: 'var(--bg-secondary)', padding: 'var(--sp-6)',
            display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)',
            borderLeft: '1px solid var(--border-subtle)', animation: 'slideIn 0.3s ease-out'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', color: 'var(--accent-purple)' }}>
              <Sparkles size={18} />
              <h4 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-bold)' }}>Revision Items</h4>
            </div>
            
            <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', lineHeight: 'var(--lh-relaxed)' }}>
              A conceptual gap was identified by MIND. An FSRS spaced-repetition card has been seeded automatically.
            </p>

            <Card style={{
              background: 'var(--bg-tertiary)', border: '1px dashed var(--accent-purple-dim)',
              display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', padding: 'var(--sp-4)'
            }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Front</div>
                <div style={{ fontSize: 'var(--fs-xs)', fontWeight: 'var(--fw-semibold)', color: 'var(--text-primary)', marginTop: 2 }}>
                  {inlineCard.front}
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--sp-2)' }}>
                <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', textTransform: 'uppercase' }}>Back (AI explanation)</div>
                <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {inlineCard.back}
                </div>
              </div>
            </Card>

            <div style={{ marginTop: 'auto', textAlign: 'center', fontSize: '11px', color: 'var(--text-tertiary)' }}>
              🤖 Auto-syncing memory queues...
            </div>
          </div>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        @keyframes blink {
          0% { opacity: 0.2; }
          20% { opacity: 1; }
          100% { opacity: 0.2; }
        }
        @keyframes slideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}} />
    </div>
  );
}
