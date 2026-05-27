'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';

const HEARTBEAT_INTERVAL = 30_000; // every 30s
const IDLE_THRESHOLD = 120_000;    // 2 minutes idle = session effectively paused

export default function SessionTracker() {
  const { startSession, endSession } = useAppStore();
  const lastActivityRef = useRef<number>(0);
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
    lastActivityRef.current = Date.now();

    // Track user activity
    const events = ['keydown', 'mousedown', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, recordActivity, { passive: true }));

    // Heartbeat: keep local session state accurate without background telemetry.
    heartbeatRef.current = setInterval(async () => {
      const idleTime = Date.now() - lastActivityRef.current;
      const isIdle = idleTime > IDLE_THRESHOLD;

      if (sessionStartRef.current && isIdle) {
        sessionStartRef.current = null;
        endSession();
      }
    }, HEARTBEAT_INTERVAL);

    return () => {
      events.forEach(e => window.removeEventListener(e, recordActivity));
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    };
  }, []);

  return null; // invisible
}
