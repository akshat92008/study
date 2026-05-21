'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAppStore } from '@/stores/appStore';

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const addToast = useAppStore((state) => state.addToast);

  useEffect(() => {
    const supabase = createClient();
    
    // We only want to subscribe to events for the current authenticated user
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    let isMounted = true;

    const setupRealtime = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isMounted) return;

      // Clean up any existing subscription first
      if (subscription) {
        await supabase.removeChannel(subscription);
        subscription = null;
      }

      subscription = supabase
        .channel(`student_events_${user.id}`, {
          config: {
            broadcast: { self: true },
          },
        })
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'student_events',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const { type, data } = payload.new;
            
            // Handle different event types dynamically
            switch (type) {
              case 'CONCEPT_STRUGGLE':
                addToast('Knowledge gap detected. Adjusting Atlas mastery...', 'info');
                router.refresh();
                break;
              case 'MOCK_TEST_COMPLETED':
                addToast('Mock test autopsy complete. New recovery sprint generated.', 'success');
                router.refresh();
                break;
              case 'SESSION_COMPLETED':
                addToast('Study session recorded. Daily snapshot updated.', 'success');
                router.refresh();
                break;
              case 'CARD_REVIEWED':
                // Silent background update
                router.refresh();
                break;
              case 'NEW_DOCUMENT_INGESTED':
                addToast('Document processed into knowledge graph.', 'success');
                router.refresh();
                break;
              default:
                // For unhandled events, just refresh the router state to grab latest data
                router.refresh();
                break;
            }
          }
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('Realtime subscription established');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            console.log('Realtime subscription closed or errored');
          }
        });
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (subscription) {
        supabase.removeChannel(subscription).catch(console.error);
      }
    };
  }, [router, addToast]);

  return <>{children}</>;
}
