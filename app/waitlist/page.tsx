'use client';

import { useState } from 'react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function WaitlistPage() {
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setStatus(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch('/api/waitlist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: formData.get('email'),
        goalType: formData.get('goalType'),
      }),
    });

    const body = await response.json().catch(() => ({}));
    setLoading(false);

    if (!response.ok) {
      setError(body.message || 'Unable to join the waitlist.');
      return;
    }

    setStatus(body.message || 'You are on the waitlist.');
    event.currentTarget.reset();
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-root)',
      padding: 'var(--sp-4)',
    }}>
      <div style={{
        width: '100%',
        maxWidth: 440,
        padding: 'var(--sp-8)',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-xl)',
      }}>
        <h1 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>
          Join the Cognition OS Waitlist
        </h1>
        <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-6)' }}>
          Access is rolling out in cohorts to ensure stability and quality.
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Input id="waitlist-email" name="email" type="email" label="Email" placeholder="you@example.com" required />
          <Input id="waitlist-goal" name="goalType" label="Goal Type" placeholder="SAT, coding, finance, language learning..." />
          {error && <p style={{ color: 'var(--danger)', fontSize: 'var(--fs-sm)' }}>{error}</p>}
          {status && <p style={{ color: 'var(--success)', fontSize: 'var(--fs-sm)' }}>{status}</p>}
          <Button type="submit" isLoading={loading} style={{ width: '100%' }}>
            Join Waitlist
          </Button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--sp-6)', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)' }}>
          Have an invite? <Link href="/signup" style={{ color: 'var(--accent-blue)' }}>Create an account</Link>
        </p>
      </div>
    </div>
  );
}
