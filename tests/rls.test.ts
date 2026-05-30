import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@supabase/supabase-js';

// Use anonymous/anon key to test RLS
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'anon_key';
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

describe('Row Level Security (RLS) Tests', () => {
  it('should deny anonymous access to profiles', async () => {
    const { data, error } = await anonClient.from('profiles').select('*');
    // RLS should return an empty array or an error depending on the policy
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it('should deny anonymous access to study_sessions', async () => {
    const { data, error } = await anonClient.from('study_sessions').select('*');
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it('should deny anonymous access to autopsy_questions', async () => {
    const { data, error } = await anonClient.from('autopsy_questions').select('*');
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it('should deny anonymous access to event_queue', async () => {
    const { data, error } = await anonClient.from('event_queue').select('*');
    expect(error || (data && data.length === 0)).toBeTruthy();
  });

  it('should deny anonymous access to mistakes', async () => {
    const { data, error } = await anonClient.from('mistakes').select('*');
    expect(error || (data && data.length === 0)).toBeTruthy();
  });
});
