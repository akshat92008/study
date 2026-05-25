'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '@/stores/appStore';

interface PulseSignal {
  type: 'keystroke_pattern' | 'response_time' | 'session_drop' | 'message_length';
  value: number;
  timestamp: number;
}

export function usePulseCollector() {
  const signalBuffer = useRef<PulseSignal[]>([]);
  const lastKeystroke = useRef<number>(Date.now());
  const flushTimer = useRef<NodeJS.Timeout | null>(null);
  const { sessionActive } = useAppStore();

  const flush = useCallback(async () => {
    if (signalBuffer.current.length === 0) return;
    
    const signals = [...signalBuffer.current];
    signalBuffer.current = [];

    try {
      await fetch('/api/pulse/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals }),
      });
    } catch {
      // Pulse failures are silent — never interrupt the study session
    }
  }, []);

  // Collect keystroke timing patterns — proxy for cognitive load
  const recordKeystroke = useCallback(() => {
    const now = Date.now();
    const gap = now - lastKeystroke.current;
    lastKeystroke.current = now;

    // Only record meaningful gaps (not held keys, not idle)
    if (gap > 50 && gap < 10000) {
      signalBuffer.current.push({
        type: 'keystroke_pattern',
        value: gap,
        timestamp: now,
      });
    }
  }, []);

  // Collect message length as engagement proxy
  const recordMessageSent = useCallback((messageLength: number, responseTimeMs: number) => {
    signalBuffer.current.push(
      { type: 'message_length', value: messageLength, timestamp: Date.now() },
      { type: 'response_time', value: responseTimeMs, timestamp: Date.now() }
    );
    flush();
  }, [flush]);

  // Flush every 5 minutes regardless
  useEffect(() => {
    if (!sessionActive) return;
    
    flushTimer.current = setInterval(flush, 5 * 60 * 1000);
    return () => {
      if (flushTimer.current) clearInterval(flushTimer.current);
      flush(); // Final flush on unmount
    };
  }, [sessionActive, flush]);

  return { recordKeystroke, recordMessageSent };
}
