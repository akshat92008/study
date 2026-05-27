'use client';

import { useState, useRef, useEffect } from 'react';

interface ScriptLine {
  speaker: 'ALEX' | 'PRIYA';
  text: string;
}

interface AudioPlayerProps {
  script: string;
  audioDataUrl: string | null;
  materialTitle: string;
}

function parseScript(raw: string): ScriptLine[] {
  return raw
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.startsWith('ALEX:') || l.startsWith('PRIYA:'))
    .map(l => ({
      speaker: l.startsWith('ALEX:') ? 'ALEX' : 'PRIYA',
      text: l.replace(/^(ALEX:|PRIYA:)\s*/, '').trim(),
    })) as ScriptLine[];
}

// ─── Real Audio Player (Google TTS result) ───────────────────────────────────
function RealAudioPlayer({
  audioDataUrl,
  materialTitle,
}: {
  audioDataUrl: string;
  materialTitle: string;
}) {
  return (
    <div
      style={{
        padding: 'var(--sp-4)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--sp-3)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--sp-2)',
        }}
      >
        <span style={{ fontSize: '20px' }}>🎙️</span>
        <div>
          <div
            style={{
              fontSize: 'var(--fs-sm)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            AI Podcast
          </div>
          <div
            style={{
              fontSize: 'var(--fs-xs)',
              color: 'var(--text-tertiary)',
            }}
          >
            {materialTitle}
          </div>
        </div>
      </div>
      <audio
        controls
        src={audioDataUrl}
        style={{ width: '100%', height: '40px' }}
      />
    </div>
  );
}

// ─── Web Speech API Fallback Player ─────────────────────────────────────────
function WebSpeechPlayer({
  lines,
  materialTitle,
}: {
  lines: ScriptLine[];
  materialTitle: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [currentLine, setCurrentLine] = useState(-1);
  const [supported, setSupported] = useState(true);
  const synthRef = useRef<SpeechSynthesis | null>(null);
  const cancelledRef = useRef(false);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setSupported(false);
      return;
    }
    synthRef.current = window.speechSynthesis;
    return () => {
      cancelledRef.current = true;
      synthRef.current?.cancel();
    };
  }, []);

  // Auto-scroll to current line
  useEffect(() => {
    if (currentLine >= 0 && lineRefs.current[currentLine]) {
      lineRefs.current[currentLine]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentLine]);

  function speakLine(index: number) {
    if (cancelledRef.current || !synthRef.current) return;
    if (index >= lines.length) {
      setPlaying(false);
      setCurrentLine(-1);
      return;
    }

    setCurrentLine(index);
    const line = lines[index];
    const utterance = new SpeechSynthesisUtterance(line.text);

    utterance.rate = 1.05;
    utterance.pitch = line.speaker === 'PRIYA' ? 1.15 : 0.9;
    utterance.volume = 1;

    utterance.onend = () => {
      if (!cancelledRef.current) speakLine(index + 1);
    };

    utterance.onerror = (e) => {
      if (e.error !== 'interrupted') {
        logger_client(`Speech error on line ${index}: ${e.error}`);
        if (!cancelledRef.current) speakLine(index + 1);
      }
    };

    synthRef.current.speak(utterance);
  }

  const handlePlay = () => {
    if (!synthRef.current) return;
    cancelledRef.current = false;
    synthRef.current.cancel();
    setPlaying(true);
    // Small timeout to let cancel complete
    setTimeout(() => speakLine(0), 100);
  };

  const handleStop = () => {
    cancelledRef.current = true;
    synthRef.current?.cancel();
    setPlaying(false);
    setCurrentLine(-1);
  };

  const handlePause = () => {
    if (synthRef.current?.speaking) {
      synthRef.current.pause();
      setPlaying(false);
    }
  };

  const handleResume = () => {
    if (synthRef.current?.paused) {
      synthRef.current.resume();
      setPlaying(true);
    }
  };

  if (!supported) {
    return (
      <div
        style={{
          padding: 'var(--sp-4)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-tertiary)',
          fontSize: 'var(--fs-sm)',
        }}
      >
        Audio playback not supported in this browser. Read the transcript below.
      </div>
    );
  }

  return (
    <div
      style={{
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: 'var(--sp-4)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
          <span style={{ fontSize: '18px' }}>🎙️</span>
          <div>
            <div
              style={{
                fontSize: 'var(--fs-sm)',
                fontWeight: 'var(--fw-semibold)',
                color: 'var(--text-primary)',
              }}
            >
              AI Podcast
            </div>
            <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
              {materialTitle} · {lines.length} exchanges
            </div>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          {!playing ? (
            <button
              onClick={currentLine >= 0 ? handleResume : handlePlay}
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--accent-primary)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--fs-sm)',
                fontWeight: 'var(--fw-medium)',
              }}
            >
              {currentLine >= 0 ? '▶ Resume' : '▶ Play'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--fs-sm)',
              }}
            >
              ⏸ Pause
            </button>
          )}
          {(playing || currentLine >= 0) && (
            <button
              onClick={handleStop}
              style={{
                padding: 'var(--sp-2) var(--sp-3)',
                background: 'var(--bg-tertiary)',
                color: 'var(--text-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: 'var(--fs-sm)',
              }}
            >
              ⏹
            </button>
          )}
        </div>
      </div>

      {/* Transcript */}
      <div
        style={{
          maxHeight: '320px',
          overflowY: 'auto',
          padding: 'var(--sp-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-2)',
        }}
      >
        {lines.map((line, i) => (
          <div
            key={i}
            ref={el => { lineRefs.current[i] = el; }}
            style={{
              padding: 'var(--sp-2) var(--sp-3)',
              borderRadius: 'var(--radius-md)',
              background:
                i === currentLine
                  ? line.speaker === 'ALEX'
                    ? 'var(--accent-cyan-dim, rgba(6,182,212,0.08))'
                    : 'var(--accent-primary-dim, rgba(99,102,241,0.08))'
                  : 'transparent',
              transition: 'background 0.25s ease',
              borderLeft:
                i === currentLine
                  ? `2px solid ${line.speaker === 'ALEX' ? 'var(--accent-cyan)' : 'var(--accent-primary)'}`
                  : '2px solid transparent',
            }}
          >
            <span
              style={{
                fontSize: 'var(--fs-xs)',
                fontWeight: 'var(--fw-bold)',
                letterSpacing: '0.05em',
                color:
                  line.speaker === 'ALEX'
                    ? 'var(--accent-cyan)'
                    : 'var(--accent-primary)',
              }}
            >
              {line.speaker}
            </span>
            <p
              style={{
                margin: 'var(--sp-1) 0 0',
                fontSize: 'var(--fs-sm)',
                color:
                  i === currentLine
                    ? 'var(--text-primary)'
                    : 'var(--text-secondary)',
                lineHeight: 1.55,
                transition: 'color 0.25s ease',
              }}
            >
              {line.text}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Small client-side logger (avoids importing server logger)
function logger_client(msg: string) {
  if (process.env.NODE_ENV !== 'production') console.warn('[AudioPlayer]', msg);
}

// ─── Main Export ─────────────────────────────────────────────────────────────
export function AudioPlayer({ script, audioDataUrl, materialTitle }: AudioPlayerProps) {
  const lines = parseScript(script);

  if (audioDataUrl) {
    return <RealAudioPlayer audioDataUrl={audioDataUrl} materialTitle={materialTitle} />;
  }

  return <WebSpeechPlayer lines={lines} materialTitle={materialTitle} />;
}
