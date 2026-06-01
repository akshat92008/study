import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestSupabaseClient, seedTestUser, cleanupTestUser } from '../helpers';
import { getOrCreateGlobalChatSession, persistChatMessage } from '@/lib/services/chat-persistence';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { EventWorkerService } from '@/lib/events/worker';
import { completeLearningSession } from '@/lib/services/session-completion';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const hasSupabaseTestEnv = Boolean(
  process.env.SUPABASE_TEST_URL &&
  (process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) &&
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const describeWithSupabase = hasSupabaseTestEnv ? describe : describe.skip;

describeWithSupabase('MVP Smoke Tests', () => {
  let supabase: any;
  let authClient: any;
  let userId: string;
  let userEmail: string;

  beforeAll(async () => {
    supabase = createTestSupabaseClient();
    userId = await seedTestUser(supabase);

    const { data: profile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single();
    userEmail = profile.email;

    authClient = createSupabaseClient(
      process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_TEST_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { error } = await authClient.auth.signInWithPassword({
      email: userEmail,
      password: 'test-password-123',
    });
    if (error) throw new Error('Failed to authenticate MVP test user: ' + error.message);
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
    expect(profile.exam_type).toBe('neet');
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

  it('5. Explicit session completion uses the real RPC, updates state, and is idempotent', async () => {
    const { data: beforeProfile } = await supabase
      .from('profiles')
      .select('streak_days, learner_state_version')
      .eq('id', userId)
      .single();

    const completionKey = `mvp-session-${Date.now()}`;
    const result = await completeLearningSession({
      userId,
      subject: 'Physics',
      chapter: 'Kinematics',
      conceptName: 'Acceleration',
      durationMinutes: 30,
      understood: false,
      gapFound: 'Acceleration definition',
      cardsCreated: 1,
      idempotencyKey: completionKey,
      client: authClient,
    });

    expect(result.sessionId).toBeDefined();

    const replay = await completeLearningSession({
      userId,
      subject: 'Physics',
      chapter: 'Kinematics',
      conceptName: 'Acceleration',
      durationMinutes: 30,
      understood: false,
      gapFound: 'Acceleration definition',
      cardsCreated: 1,
      idempotencyKey: completionKey,
      client: authClient,
    });
    expect(replay.sessionId).toBe(result.sessionId);

    const { data: sessions, error: sessionErr } = await supabase
      .from('study_sessions')
      .select('id, duration_minutes, metadata')
      .eq('user_id', userId)
      .eq('metadata->>completion_key', completionKey);

    expect(sessionErr).toBeNull();
    expect(sessions).toHaveLength(1);
    expect(sessions?.[0].duration_minutes).toBe(30);

    const { data: afterProfile } = await supabase
      .from('profiles')
      .select('streak_days, learner_state_version')
      .eq('id', userId)
      .single();
    expect(afterProfile.learner_state_version).toBeGreaterThan(beforeProfile.learner_state_version ?? 0);
    expect(afterProfile.streak_days).toBeGreaterThanOrEqual(1);

    const { data: events, error: eventErr } = await supabase
      .from('event_queue')
      .select('id, type')
      .eq('user_id', userId)
      .eq('type', 'STUDY_SESSION_COMPLETED');
    expect(eventErr).toBeNull();
    expect(events?.length).toBeGreaterThan(0);
  });

  it('6 & 7. AUTOPSY event can enqueue and worker process without crashing', async () => {
    const eventId = await EventDispatcher.publish({
      userId,
      type: 'AUTOPSY_MOCK_PROCESSED',
      data: { autopsyId: '123e4567-e89b-12d3-a456-426614174000' },
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
      due: '2026-05-01T00:00:00.000Z',
      subject: 'Physics',
      chapter: 'Kinematics',
      reps: 0
    }).select('id').single();
    
    expect(insertErr).toBeNull();

    const newDate = '2030-01-01T00:00:00.000Z';
    const { error: updateErr } = await supabase.from('revision_cards').update({
      due: newDate,
      reps: 1
    }).eq('id', card.id);

    expect(updateErr).toBeNull();

    const { data: updatedCard } = await supabase
      .from('revision_cards')
      .select('*')
      .eq('id', card.id)
      .single();
      
    expect(new Date(updatedCard.due).toISOString()).toBe(newDate);
    expect(updatedCard.reps).toBe(1);
  });
});

describe('MVP Frontend Logic Smoke Tests', () => {
  it('9. PULSE is hidden from MVP navigation', () => {
    const sidebarPath = path.resolve(__dirname, '../../components/layout/Sidebar.tsx');
    const sidebarContent = fs.readFileSync(sidebarPath, 'utf-8');
    
    const cleanContent = sidebarContent.replace(/\{?\/\*.*?\*\/\}/gs, '');
    expect(cleanContent).not.toMatch(/Pulse/i);
    expect(cleanContent).not.toMatch(/COMMAND/i);
    for (const label of ['Today', 'MIND', 'Test Analysis', 'Progress', 'Revision Due']) {
      expect(cleanContent).toContain(label);
    }
  });

  it('9b. Runtime product copy uses the corrected OS architecture', () => {
    const landingPath = path.resolve(__dirname, '../../components/landing/LandingClient.tsx');
    const commandBarPath = path.resolve(__dirname, '../../components/ui/CommandBar.tsx');
    const landingContent = fs.readFileSync(landingPath, 'utf-8');
    const commandBarContent = fs.readFileSync(commandBarPath, 'utf-8');

    expect(landingContent).not.toMatch(/PULSE|six engines|six modules|six separate apps|COMMAND/i);
    expect(commandBarContent).toContain("Today's Mission");
    expect(commandBarContent).toContain('MIND');
    expect(commandBarContent).toContain('Test Analysis');
    expect(commandBarContent).toContain('Progress');
    expect(commandBarContent).toContain('Revision Due');
    expect(commandBarContent).not.toContain('Knowledge Base');
    expect(commandBarContent).not.toContain('Mistake Intelligence');
  });

  it('9c. Dashboard does not expose planner microtargets in MVP', () => {
    const dashboardPagePath = path.resolve(__dirname, '../../app/(dashboard)/dashboard/page.tsx');
    const dashboardApiPath = path.resolve(__dirname, '../../app/api/dashboard/route.ts');
    const dashboardPage = fs.readFileSync(dashboardPagePath, 'utf-8');
    const dashboardApi = fs.readFileSync(dashboardApiPath, 'utf-8');

    expect(dashboardPage).not.toContain("Today's Microtargets");
    expect(dashboardPage).not.toContain('@/lib/actions/planner');
    expect(dashboardPage).not.toContain('toggleTask');
    expect(dashboardApi).not.toContain('getPlanForDate');
  });

  it('10. AUTOPSY validation rejects fake PDF/image', async () => {
    const { validateMagicBytesArray } = await import('@/lib/utils/magicBytes');
    // Fake PDF (doesn't start with %PDF)
    const fakePdfBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(validateMagicBytesArray(fakePdfBytes, 'application/pdf')).toBe(false);

    // Fake JPEG (doesn't start with FF D8 FF)
    const fakeJpegBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47]); // This is PNG magic bytes
    expect(validateMagicBytesArray(fakeJpegBytes, 'image/jpeg')).toBe(false);

    // Fake WEBP (starts with RIFF but missing WEBP at byte 8)
    const fakeWebpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, 
      0x41, 0x56, 0x49, 0x20  // AVI instead of WEBP
    ]);
    expect(validateMagicBytesArray(fakeWebpBytes, 'image/webp')).toBe(false);

    // Valid WEBP
    const validWebpBytes = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // RIFF
      0x00, 0x00, 0x00, 0x00, 
      0x57, 0x45, 0x42, 0x50  // WEBP
    ]);
    expect(validateMagicBytesArray(validWebpBytes, 'image/webp')).toBe(true);
  });
});
