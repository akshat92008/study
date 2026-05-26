'use client';

import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';

export function PulseListener({ userId }: { userId: string }) {
  const { addToast } = useAppStore();

  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();

    const channel = supabase
      .channel('realtime:pulse_signals')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pulse_signals',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newSignal = payload.new;
          
          if (newSignal.emotional_state === 'overwhelmed') {
            addToast('High cognitive load detected. Consider taking a 5-minute break.', 'error');
          } else if (newSignal.emotional_state === 'frustrated') {
            addToast('You seem frustrated. We are adapting the difficulty of upcoming tasks.', 'info');
          } else if (newSignal.emotional_state === 'focused' || newSignal.emotional_state === 'flow') {
            addToast('You are in the zone! Keep up the great work.', 'success');
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, addToast]);

  return null; // Invisible listener component
}
