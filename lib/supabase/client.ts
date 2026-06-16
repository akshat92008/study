'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith('http')) {
    console.error('CRITICAL CONFIG ERROR: NEXT_PUBLIC_SUPABASE_URL is missing or invalid. It must start with https://.');
  }

  return createBrowserClient(
    supabaseUrl || 'https://invalid-url.supabase.co',
    supabaseKey || 'invalid-key'
  );
}
