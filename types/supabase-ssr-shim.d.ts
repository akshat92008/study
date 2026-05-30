declare module '@supabase/ssr' {
  import type { SupabaseClient } from '@supabase/supabase-js';

  export function createBrowserClient(...args: unknown[]): SupabaseClient;
  export function createServerClient(...args: unknown[]): SupabaseClient;
}
