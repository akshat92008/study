import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

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

export async function createClient() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    throw new Error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or invalid. It must start with https://. Please check your Vercel Environment Variables.');
  }

  if (!supabaseKey) {
    throw new Error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_SUPABASE_ANON_KEY is missing. Please check your Vercel Environment Variables.');
  }

  return createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      global: {
        fetch: fetchWithTimeout,
      },
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: any) {
          try {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  );
}
