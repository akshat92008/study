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
            addToast({
              id: Date.now().toString(),
              type: 'error',
              message: 'High cognitive load detected. Consider taking a 5-minute break.',
            });
          } else if (newSignal.emotional_state === 'frustrated') {
            addToast({
              id: Date.now().toString(),
              type: 'info',
              message: 'You seem frustrated. We are adapting the difficulty of upcoming tasks.',
            });
          } else if (newSignal.emotional_state === 'focused' || newSignal.emotional_state === 'flow') {
            addToast({
              id: Date.now().toString(),
              type: 'success',
              message: 'You are in the zone! Keep up the great work.',
            });
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
