'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';

const HEARTBEAT_INTERVAL = 30_000; // every 30s
const IDLE_THRESHOLD = 120_000;    // 2 minutes idle = session effectively paused

export default function SessionTracker() {
  const { sessionActive, startSession, endSession } = useAppStore();
  const lastActivityRef = useRef<number>(Date.now());
  const heartbeatRef = useRef<NodeJS.Timeout | null>(null);
  const sessionStartRef = useRef<number | null>(null);

  const recordActivity = () => {
    lastActivityRef.current = Date.now();
    if (!sessionStartRef.current) {
      sessionStartRef.current = Date.now();
      startSession();
    }
  };

  useEffect(() => {
    // Track user activity
    const events = ['keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }));

    // Heartbeat: check session state and send pulse signal
    heartbeatRef.current = setInterval(async () => {
      const idleTime = Date.now() - lastActivityRef.current;
      const isIdle = idleTime > IDLE_THRESHOLD;

      if (sessionStartRef.current && isIdle) {
        // Session ended due to inactivity
        const durationMs = Date.now() - sessionStartRef.current;
        const durationMinutes = Math.round(durationMs / 60000);

        if (durationMinutes >= 1) {
          try {
            await fetch('/api/pulse/session', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ durationMinutes, endReason: 'idle' })
            });
          } catch {}
        }

        sessionStartRef.current = null;
        endSession();
      } else if (sessionStartRef.current && !isIdle) {
        // Active session heartbeat
        const durationMinutes = Math.round((Date.now() - sessionStartRef.current) / 60000);
        try {
          await fetch('/api/pulse/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ durationMinutes, endReason: null, heartbeat: true })
          });
        } catch {}
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      events.forEach(e => window.removeEventListener(e, recordActivity));
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  return null; // invisible
}
