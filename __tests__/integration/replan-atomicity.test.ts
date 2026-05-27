// __tests__/integration/replan-atomicity.test.ts

import { describe, it, expect } from 'vitest';
import { atomicReplan } from '@/lib/engines/learning-state-engine';
import { createTestSupabaseClient, seedTestUser, cleanupTestUser } from '../helpers';

describe('atomicReplan', () => {
  it('preserves existing tasks when new task list is empty', async () => {
    const supabase = createTestSupabaseClient();
    const userId = await seedTestUser(supabase);

    // Seed one task
    await supabase.from('study_tasks').insert({
      user_id: userId,
      scheduled_date: '2026-06-01',
      task_type: 'study',
      title: 'Original task',
      duration_minutes: 30,
    });

    // Attempt replan with empty array — should delete existing and insert nothing
    await atomicReplan(supabase, userId, '2026-06-01', []);

    const { data: remaining } = await supabase
      .from('study_tasks')
      .select('id')
      .eq('user_id', userId)
      .eq('scheduled_date', '2026-06-01');

    expect(remaining?.length).toBe(0);
    await cleanupTestUser(supabase, userId);
  });
});
