'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Download, ExternalLink, Loader2, Trash2 } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function SettingsPage() {
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const requestDeletion = async () => {
    const confirmation = window.prompt('Type DELETE MY ACCOUNT to confirm the deletion request.');
    if (confirmation !== 'DELETE MY ACCOUNT') {
      setMessage('Account deletion was not requested.');
      return;
    }

    setDeleting(true);
    setMessage(null);
    try {
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Deletion request failed.');
      window.location.assign('/');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Deletion request failed.');
      setDeleting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)', maxWidth: 820 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 'var(--fs-xl)', fontWeight: 900 }}>Settings</h1>
        <p style={{ margin: '6px 0 0', color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)' }}>
          Manage your Cognition data, account, and support links.
        </p>
      </div>

      <Card padding="lg">
        <h2 style={{ marginTop: 0, fontSize: 'var(--fs-md)' }}>Your data</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
          Download a JSON export of your goals, sessions, materials, practice, notes, learner events, mastery, mistakes, repair retests, activity, and notifications.
        </p>
        <a href="/api/account/export" download style={{ textDecoration: 'none' }}>
          <Button><Download size={16} /> Export account data</Button>
        </a>
      </Card>

      <Card padding="lg">
        <h2 style={{ marginTop: 0, fontSize: 'var(--fs-md)' }}>Help and policies</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
          {[
            ['Support', '/support'],
            ['Privacy', '/privacy'],
            ['Terms', '/terms'],
            ['Refund policy', '/refund'],
          ].map(([label, href]) => (
            <Link key={href} href={href} style={{ color: 'var(--accent-blue)', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
              {label} <ExternalLink size={13} />
            </Link>
          ))}
        </div>
      </Card>

      <Card padding="lg" style={{ borderColor: 'var(--danger)' }}>
        <h2 style={{ marginTop: 0, fontSize: 'var(--fs-md)', color: 'var(--danger)' }}>Delete account</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-sm)', lineHeight: 1.6 }}>
          This signs you out and either deletes the account immediately or records a durable deletion request for processing.
        </p>
        <Button onClick={requestDeletion} disabled={deleting} variant="secondary">
          {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          Request account deletion
        </Button>
        {message && <p role="status" style={{ color: 'var(--text-secondary)', fontSize: 'var(--fs-xs)', marginBottom: 0 }}>{message}</p>}
      </Card>
    </div>
  );
}
