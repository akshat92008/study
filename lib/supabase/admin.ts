import { createClient } from '@supabase/supabase-js';

const fetchWithTimeout = async (input: RequestInfo | URL, init?: RequestInit) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);
  
  return Promise.race([
    fetch(input, { ...init, signal: controller.signal }).catch(err => {
      if (err.name === 'AbortError') {
        throw new Error('Supabase API timed out after 5 seconds. Your project might be asleep or unavailable.');
      }
      throw err;
    }).finally(() => clearTimeout(timeoutId)),
    new Promise<Response>((_, reject) => 
      setTimeout(() => reject(new Error('Supabase API timed out after 5 seconds. Your project might be asleep or unavailable.')), 5000)
    )
  ]);
};

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_SUPABASE_URL is missing. Please check your Vercel Environment Variables.');
  }

  if (!serviceRoleKey) {
    throw new Error('CRITICAL CONFIG ERROR: SUPABASE_SERVICE_ROLE_KEY is missing. Please check your Vercel Environment Variables.');
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        fetch: fetchWithTimeout,
      }
    }
  );
}
