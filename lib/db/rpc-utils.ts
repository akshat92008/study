'use client';

import { createClient } from '@/lib/supabase/client';

/**
 * Checks whether the `match_chat_memory` RPC exists.
 * The simplest reliable way is to attempt a lightweight call and catch the
 * "function does not exist" error. We send a dummy payload that the function
 * can safely ignore.
 */
export async function hasMatchChatMemoryRpc(): Promise<boolean> {
  const supabase = createClient();
  try {
    // Call the RPC with a minimal, safe payload. The function should return
    // quickly; we ignore its actual result because we only care that it
    // exists.
    const { data, error } = await supabase.rpc('match_chat_memory', {
      user_id: '00000000-0000-0000-0000-000000000000', // dummy UUID
      query: ''
    });
    // If the RPC exists, supabase will either return data or a runtime error
    // from the function, but not a "function does not exist" error.
    if (error && error.message?.includes('function match_chat_memory does not exist')) {
      return false;
    }
    return true;
  } catch (e: any) {
    // Supabase throws when the function is missing.
    if (e.message?.includes('function match_chat_memory does not exist')) {
      return false;
    }
    console.error('[rpc-utils] Unexpected error while checking RPC:', e);
    return false;
  }
}

/**
 * Executes the migration file that defines `match_chat_memory`.
 * Uses the Supabase CLI via a child_process exec. This works in local
 * development and CI environments where the CLI is available.
 */
export async function applyMatchChatMemoryMigration(): Promise<void> {
  const { execSync } = await import('child_process');
  console.log('[MIGRATION] Applying 024_match_chat_memory.sql...');
  execSync(
    `npx supabase migration up -f lib/db/migrations/024_match_chat_memory.sql`,
    { stdio: 'inherit' }
  );
  console.log('[MIGRATION] Completed.');
}
