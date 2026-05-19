'use client';

import { useEffect, useRef } from 'react';
import { useAppStore } from '@/stores/appStore';

export default function SessionTracker() {
  const { startSession, endSession, sessionActive } = useAppStore();
  const idleTimeout = useRef<NodeJS.Timeout | null>(null);

  // Send session data to the database
  const logSessionToDB = async (durationMinutes: number) => {
    if (durationMinutes < 1) return; // Ignore accidental page reloads
    try {
      await fetch('/api/pulse/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationMinutes }),
        keepalive: true // Ensures it fires even if the tab is closing
      });
    } catch (e) {
      console.error('Failed to log session telemetry');
    }
  };

  useEffect(() => {
    startSession();

    const resetIdleTimer = () => {
      if (!sessionActive) startSession();
      
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
      
      // If no mouse/keyboard movement for 5 minutes, end the session
      idleTimeout.current = setTimeout(() => {
        const duration = endSession();
        if (duration > 0) logSessionToDB(duration);
      }, 5 * 60 * 1000); 
    };

    // Track interactions
    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);
    window.addEventListener('click', resetIdleTimer);
    window.addEventListener('scroll', resetIdleTimer);

    // Save on tab close
    window.addEventListener('beforeunload', () => {
      const duration = endSession();
      if (duration > 0) logSessionToDB(duration);
    });

    resetIdleTimer();

    return () => {
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
      window.removeEventListener('click', resetIdleTimer);
      window.removeEventListener('scroll', resetIdleTimer);
      if (idleTimeout.current) clearTimeout(idleTimeout.current);
    };
  }, []);

  return null; // Invisible telemetry component
}
