// __tests__/helpers.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';

export function createTestSupabaseClient(): SupabaseClient {
  const url = process.env.SUPABASE_TEST_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

export async function seedTestUser(supabase: SupabaseClient): Promise<string> {
  const email = `test-${Date.now()}@test-cognition.internal`;
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: 'test-password-123',
    email_confirm: true,
  });
  if (error || !data.user) throw new Error('Failed to seed test user: ' + error?.message);

  await supabase.from('profiles').insert({
    id: data.user.id,
    email,
    onboarding_complete: true,
    exam_type: 'NEET',
    target_date: '2027-05-01',
    daily_hours: 6,
    learning_style: 'visual',
  });

  return data.user.id;
}

export async function cleanupTestUser(supabase: SupabaseClient, userId: string): Promise<void> {
  await supabase.auth.admin.deleteUser(userId);
  // Cascade deletes handle all child rows if FK constraints are set with ON DELETE CASCADE
}
