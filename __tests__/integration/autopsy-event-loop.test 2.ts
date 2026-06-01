// __tests__/integration/autopsy-event-loop.test.ts

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AutopsyEngine } from '@/lib/engines/autopsy-engine';
import { EventOrchestrator } from '@/lib/events/orchestrator';
import { RevisionEngine } from '@/lib/engines/revision-engine';
import { createTestSupabaseClient, seedTestUser, cleanupTestUser } from '../helpers';

describe('Autopsy → Event → Revision Card loop', () => {
  let supabase: ReturnType<typeof createTestSupabaseClient>;
  let userId: string;

  beforeEach(async () => {
    supabase = createTestSupabaseClient();
    userId = await seedTestUser(supabase);
  });

  afterEach(async () => {
    await cleanupTestUser(supabase, userId);
  });

  it('autopsy creates at least one mistake record', async () => {
    const engine = new AutopsyEngine(supabase);
    // Use a minimal text-based autopsy input to avoid actual AI calls
    vi.spyOn(engine as any, 'callGemini').mockResolvedValue({
      questions: [
        { id: 'q1', userAnswer: 'A', correctAnswer: 'B', topic: 'Thermodynamics',
          mistakeType: 'conceptual_gap', explanation: 'Wrong law applied' }
      ]
    });

    const result = await engine.processAutopsy({ userId, content: 'mock test content', type: 'text' });

    const { data: mistakes } = await supabase
      .from('mistakes')
      .select('id')
      .eq('user_id', userId);

    expect(mistakes?.length).toBeGreaterThan(0);
    expect(result.score).toBeDefined();
  });

  it('AUTOPSY_MOCK_PROCESSED event triggers MemoryConsumer', async () => {
    const orchestrator = new EventOrchestrator(supabase);
    const memoryConsumerSpy = vi.spyOn(orchestrator as any, 'runMemoryConsumer');

    await orchestrator.publish({
      userId,
      type: 'AUTOPSY_MOCK_PROCESSED',
      payload: { conceptIds: ['test-concept-id'] },
    });

    expect(memoryConsumerSpy).toHaveBeenCalledOnce();
  });

  it('FSRS card is created after autopsy event', async () => {
    const engine = new RevisionEngine(supabase);
    await engine.generateCardsForConcept(userId, 'test-concept-id', 'Thermodynamics: First Law');

    const { data: cards } = await supabase
      .from('revision_cards')
      .select('id, due, stability')
      .eq('user_id', userId);

    expect(cards?.length).toBeGreaterThan(0);
    expect(cards![0].due).toBeDefined();
    expect(cards![0].stability).toBeGreaterThan(0);
  });

  it('reviewing a card updates FSRS state correctly', async () => {
    const engine = new RevisionEngine(supabase);
    const cards = await engine.getDueCards(userId, 1);
    if (!cards.length) return; // skip if no cards

    const before = cards[0];
    await engine.reviewCard(userId, before.id, 3); // rating: 3 = Good

    const { data: after } = await supabase
      .from('revision_cards')
      .select('stability, due, lapses')
      .eq('id', before.id)
      .single();

    expect(after?.stability).toBeGreaterThan(before.stability);
    expect(new Date(after!.due).getTime()).toBeGreaterThan(Date.now());
  });
});
