'use server';

import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function signUp(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const fullName = formData.get('fullName') as string;

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
