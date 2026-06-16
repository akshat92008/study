import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

if (typeof window !== 'undefined') {
  throw new Error('admin client is server-only');
}

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or invalid. It must start with https://. Please check your Vercel Environment Variables.');
  }

  if (!serviceRoleKey || serviceRoleKey.length < 20) {
    throw new Error('CRITICAL CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY is missing or invalid. Please check your Vercel Environment Variables.');
  }
  
  adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: (...args: Parameters<typeof fetch>) => fetch(...args),
      },
      db: {
        schema: 'public',
      },
    }
  );
  
  return adminClient;
}
