'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { enforceBetaSignupGate } from '@/lib/beta/gate';

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;
  const inviteCode = formData.get('inviteCode') as string | null;

  const gate = await enforceBetaSignupGate({ email, inviteCode });
  if (!gate.allowed) return { error: gate.reason || 'Public beta signup is currently paused.' };

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName },
    },
  });

  if (error) return { error: error.message };
  redirect('/');
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect('/');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}

export async function signInAsGuest() {
  const supabase = await createClient();
  
  const { data, error } = await supabase.auth.signInAnonymously();

  if (error || !data.user) {
    return {
      error: error?.message || 'Guest access is not enabled for this project.',
    };
  }
  
  redirect('/onboarding');
}
