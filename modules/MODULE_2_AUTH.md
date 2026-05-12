# MODULE 2: Authentication

## PROMPT FOR AI BUILDER

```
You are building the auth system for Cognition OS using Supabase Auth.
Create login/signup pages with premium dark UI. Use Server Actions for auth.
Files from MODULE 0 (supabase clients, middleware) already exist — do NOT recreate them.
```

---

## STEP 1: Auth Actions — `lib/actions/auth.ts`

```typescript
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
  redirect('/dashboard');
}

export async function signIn(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect('/dashboard');
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

---

## STEP 2: Login Page — `app/(auth)/login/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { signIn } from '@/lib/actions/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-root)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, hsla(220,90%,56%,0.08) 0%, transparent 60%)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, padding: 'var(--sp-8)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
      }} className="animate-fade">
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
          <h1 style={{
            fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)',
            letterSpacing: 'var(--ls-tight)', marginBottom: 'var(--sp-2)',
          }}>
            <span style={{ color: 'var(--accent-blue)' }}>Cognition</span> OS
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
            Sign in to your academic operating system
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Input id="login-email" name="email" type="email" label="Email" placeholder="you@example.com" required />
          <Input id="login-password" name="password" type="password" label="Password" placeholder="••••••••" required />
          {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
          <Button id="login-submit" type="submit" isLoading={loading} style={{ width: '100%', marginTop: 'var(--sp-2)' }}>
            Sign In
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--sp-6)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          No account? <Link href="/signup" style={{ color: 'var(--accent-blue)' }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
```

---

## STEP 3: Signup Page — `app/(auth)/signup/page.tsx`

```tsx
'use client';

import { useState } from 'react';
import { signUp } from '@/lib/actions/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function SignupPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await signUp(formData);
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-root)',
      backgroundImage: 'radial-gradient(ellipse at 50% 0%, hsla(265,80%,60%,0.08) 0%, transparent 60%)',
    }}>
      <div style={{
        width: '100%', maxWidth: 420, padding: 'var(--sp-8)',
        background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
      }} className="animate-fade">
        <div style={{ textAlign: 'center', marginBottom: 'var(--sp-8)' }}>
          <h1 style={{
            fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)',
            letterSpacing: 'var(--ls-tight)', marginBottom: 'var(--sp-2)',
          }}>
            Join <span style={{ color: 'var(--accent-purple)' }}>Cognition</span> OS
          </h1>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)' }}>
            Your AI-powered academic operating system
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Input id="signup-name" name="fullName" label="Full Name" placeholder="Your name" required />
          <Input id="signup-email" name="email" type="email" label="Email" placeholder="you@example.com" required />
          <Input id="signup-password" name="password" type="password" label="Password" placeholder="Min 8 characters" required minLength={8} />
          {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
          <Button id="signup-submit" type="submit" isLoading={loading} style={{ width: '100%', marginTop: 'var(--sp-2)' }}>
            Create Account
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--sp-6)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          Already have an account? <Link href="/login" style={{ color: 'var(--accent-blue)' }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
```

---

## STEP 4: Auth Layout — `app/(auth)/layout.tsx`

```tsx
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
```

---

## VERIFICATION

```bash
npm run dev
# Visit /login — premium dark login form should render
# Visit /signup — premium dark signup form should render
# Clicking "Create one" / "Sign in" links should navigate between pages
```

**→ NEXT: MODULE 3 (Database)**
