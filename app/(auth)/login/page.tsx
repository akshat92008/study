'use client';

import { useState } from 'react';
import { signIn, signInAsGuest } from '@/lib/actions/auth';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Link from 'next/link';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(e.currentTarget);
    const result = await signIn(formData);
    if (result?.error) { setError(result.error); setLoading(false); }
  }

  async function handleGuestSignIn() {
    setGuestLoading(true);
    setError('');
    const result = await signInAsGuest();
    if (result?.error) { setError(result.error); setGuestLoading(false); }
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

        <div style={{ display: 'flex', alignItems: 'center', margin: 'var(--sp-6) 0' }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
          <span style={{ padding: '0 var(--sp-4)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}>OR</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-subtle)' }} />
        </div>

        <Button 
          variant="outline" 
          onClick={handleGuestSignIn} 
          isLoading={guestLoading} 
          style={{ width: '100%' }}
        >
          Continue as Guest
        </Button>

        <p style={{ textAlign: 'center', marginTop: 'var(--sp-6)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          No account? <Link href="/signup" style={{ color: 'var(--accent-blue)' }}>Create one</Link>
        </p>
      </div>
    </div>
  );
}
