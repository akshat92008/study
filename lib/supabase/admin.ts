import { createClient, SupabaseClient } from '@supabase/supabase-js';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(input, { ...init, signal: controller.signal });
    return response;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Supabase API timed out after 5 seconds. Your project might be asleep or unavailable.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
};

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient {
  if (adminClient) return adminClient;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or invalid.');
  }
  
  if (!serviceRoleKey) {
    throw new Error('CRITICAL CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY is missing.');
  }

  adminClient = createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  return adminClient;
}
