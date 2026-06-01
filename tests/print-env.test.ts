import { test } from 'vitest';
test('print env', () => {
  console.log('SUPABASE_TEST_URL:', process.env.SUPABASE_TEST_URL);
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('SUPABASE_SERVICE_ROLE_KEY:', !!process.env.SUPABASE_SERVICE_ROLE_KEY);
});
