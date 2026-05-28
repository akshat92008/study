import { EventTypes } from '@/lib/events/types';
import { createClient } from '@/lib/supabase/server';

/**
 * Each consumer receives the event payload and performs domain‑specific side effects.
 * For now these are simple stubs – replace with real business logic.
 */
export const eventConsumers: Partial<Record<keyof typeof EventTypes, (payload: any, userId: string) => Promise<void>>> = {
  MIND_MESSAGE_CREATED: async (payload, userId) => {
    // Example: track message analytics
    const supabase = await createClient();
    await supabase.from('mind_message_events').insert({ user_id: userId, payload });
  },
  MIND_TUTOR_COMPLETED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('mind_tutor_events').insert({ user_id: userId, payload });
  },
  AUTOPSY_MOCK_PROCESSED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('autopsy_events').insert({ user_id: userId, payload });
  },
  ATLAS_MASTERY_UPDATED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('atlas_mastery_events').insert({ user_id: userId, payload });
  },
  MEMORY_CARD_CREATED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('memory_card_events').insert({ user_id: userId, payload });
  },
  MEMORY_CARD_REVIEWED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('memory_review_events').insert({ user_id: userId, payload });
  },
  COMMAND_SESSION_CREATED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('command_session_events').insert({ user_id: userId, payload });
  },
  COMMAND_SESSION_COMPLETED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('command_session_events').insert({ user_id: userId, payload, completed: true });
  },
  INGESTION_DOCUMENT_PROCESSED: async (payload, userId) => {
    const supabase = await createClient();
    await supabase.from('ingestion_events').insert({ user_id: userId, payload });
  },
};
