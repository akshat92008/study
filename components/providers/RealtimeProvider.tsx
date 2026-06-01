'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const addToast = useAppStore((state) => state.addToast);
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const supabase = createClient();
    
    // We only want to subscribe to events for the current authenticated user
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;
    let reconnectTimeout: NodeJS.Timeout | null = null;
    let reconnectAttempts = 0;

    const debouncedRefresh = () => {
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = setTimeout(() => {
        if (isMounted) router.refresh();
      }, 5000); // 5-second debounce prevents refresh storms
    };

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      // Clean up any existing subscription first
      if (subscription) {
        await supabase.removeChannel(subscription);
        subscription = null;
      }

      subscription = supabase
        .channel(`event_queue_${user.id}`, {
          config: {
            broadcast: { self: true },
          },
        })
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'event_queue',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const row = payload.new as any;
            if (!row) return;
            const { type, status } = row;
            
            // Handle different event types dynamically
            switch (type) {
              case 'CONCEPT_DISCOVERED':
                addToast('Knowledge gap detected. Adjusting Atlas mastery...', 'info');
                debouncedRefresh();
                break;
              case 'AUTOPSY_MOCK_PROCESSED':
                addToast('Mock test autopsy complete. New recovery sprint generated.', 'success');
                debouncedRefresh();
                break;
              case 'STUDY_SESSION_COMPLETED':
              case 'MIND_TUTOR_COMPLETED':
                addToast('Study session recorded. Daily snapshot updated.', 'success');
                debouncedRefresh();
                break;
              case 'MEMORY_CARD_REVIEWED':
                // Silent background update
                debouncedRefresh();
                break;
              case 'INGESTION_DOCUMENT_PROCESSED':
                addToast('Document processed into knowledge graph.', 'success');
                debouncedRefresh();
                break;
              case 'CHAT_MESSAGE_PROCESSED':
                // Silent background update to keep UI fresh
                debouncedRefresh();
                break;
              default:
                // For unhandled events, debounce to grab latest data safely
                debouncedRefresh();
                break;
            }

            if (status === 'COMPLETED' || status === 'PARTIAL_FAILED') {
              debouncedRefresh();
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime subscription established');
            reconnectAttempts = 0; // reset on success
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.log('Realtime subscription closed or errored, scheduling reconnect...');
            if (isMounted) {
              const jitter = Math.random() * 1000;
              const backoff = Math.min(1000 * Math.pow(2, reconnectAttempts) + jitter, 30000);
              reconnectAttempts++;
              reconnectTimeout = setTimeout(setupRealtime, backoff);
            }
          }
        });
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      if (subscription) {
        supabase.removeChannel(subscription).catch(console.error);
      }
    };
  }, [router, addToast]);

  return <>{children}</>;
}
