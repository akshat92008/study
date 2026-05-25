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
  
  // Try anonymous sign-in first (standard approach)
  let { data, error } = await supabase.auth.signInAnonymously();
  
  // If anonymous sign-ins are disabled in Supabase, fallback to a dummy user
  if (error || !data.user) {
    const randomStr = Math.random().toString(36).substring(2, 10);
    const email = `guest_${randomStr}@cognition.os`;
    const password = `guest_${randomStr}_password`;
    
    const { error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: 'Guest User', is_guest: true },
      },
    });
    
    if (signUpError) return { error: signUpError.message };
  }
  
  redirect('/onboarding');
}
