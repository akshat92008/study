import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSupabaseClient, seedTestUser, cleanupTestUser } from '../helpers';
import { getOrCreateGlobalChatSession, persistChatMessage } from '@/lib/services/chat-persistence';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventWorkerService } from '@/lib/events/worker';
import fs from 'fs';
import path from 'path';

const hasSupabaseTestEnv = Boolean(
  (process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL) &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const describeWithSupabase = hasSupabaseTestEnv ? describe : describe.skip;

describeWithSupabase('MVP Smoke Tests', () => {
  let supabase: any;
  let userId: string;

  beforeAll(async () => {
    supabase = createTestSupabaseClient();
    userId = await seedTestUser(supabase);
  });

  afterAll(async () => {
    if (userId && supabase) {
      await cleanupTestUser(supabase, userId);
    }
  });

  it('1. New user has profile', async () => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
      
    expect(error).toBeNull();
    expect(profile).toBeDefined();
    expect(profile.exam_type).toBe('NEET');
  });

  it('2. Global chat creates/reuses one global session', async () => {
    const sessionId1 = await getOrCreateGlobalChatSession(supabase, userId);
    expect(sessionId1).toBeDefined();

    const sessionId2 = await getOrCreateGlobalChatSession(supabase, userId);
    expect(sessionId2).toBe(sessionId1);
  });

  it('3. One chat turn creates no duplicate messages', async () => {
    const sessionId = await getOrCreateGlobalChatSession(supabase, userId);
    
    await persistChatMessage(supabase, {
      sessionId,
      userId,
      role: 'user',
      content: 'Hello World MVP',
    });

    const { data: messages, error } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('session_id', sessionId)
      .eq('content', 'Hello World MVP');
    
    expect(error).toBeNull();
    expect(messages?.length).toBe(1);
  });

  it('4. Session card route simulation', async () => {
    const { data: cards, error } = await supabase
      .from('session_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('date', new Date().toISOString().split('T')[0]);
      
    expect(error).toBeNull();
    expect(Array.isArray(cards)).toBe(true);
  });

  it('5. Session completion inserts study session', async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: session, error } = await supabase.from('study_sessions').insert({
      user_id: userId,
      date: today,
      duration_minutes: 30,
      understood: true,
      cards_created: 5,
    }).select().single();

    expect(error).toBeNull();
    expect(session).toBeDefined();
    expect(session.duration_minutes).toBe(30);
  });

  it('6 & 7. AUTOPSY event can enqueue and worker process without crashing', async () => {
    const eventId = await EventDispatcher.publish({
      userId,
      type: 'AUTOPSY_MOCK_PROCESSED',
      data: { mockId: '123' },
    });
    expect(eventId).toBeDefined();

    const processedCount = await EventWorkerService.processBatch(1, 1);
    expect(typeof processedCount).toBe('number');
  });

  it('8. MEMORY card review updates due date', async () => {
    const { data: card, error: insertErr } = await supabase.from('revision_cards').insert({
      user_id: userId,
      front: 'Front MVP',
      back: 'Back MVP',
      due_at: '2026-05-01T00:00:00.000Z',
      review_count: 0
    }).select('id').single();
    
    expect(insertErr).toBeNull();

    const newDate = '2030-01-01T00:00:00.000Z';
    const { error: updateErr } = await supabase.from('revision_cards').update({
      due_at: newDate,
      review_count: 1
    }).eq('id', card.id);

    expect(updateErr).toBeNull();

    const { data: updatedCard } = await supabase
      .from('revision_cards')
      .select('*')
      .eq('id', card.id)
      .single();
      
    expect(updatedCard.due_at).toBe(newDate);
    expect(updatedCard.review_count).toBe(1);
  });
});

describe('MVP Frontend Logic Smoke Tests', () => {
  it('9. PULSE is hidden from MVP navigation', () => {
    const sidebarPath = path.resolve(__dirname, '../../components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    
    const cleanContent = sidebarContent.replace(/\{?\/\*.*?\*\/\}/gs, '');
    expect(cleanContent).not.toMatch(/Pulse/i);
  });
});
