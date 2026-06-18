'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { Github, Terminal, GitCommit, RefreshCw, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

export default function GithubSyncPage() {
  const [status, setStatus] = useState<string>('Loading git status...');
  const [message, setMessage] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [output, setOutput] = useState<{ stdout: string; stderr: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/git');
      const data = await res.json();
      if (data.error) {
        setStatus(`Error: ${data.error}`);
      } else {
        setStatus(data.status || 'No output');
      }
    } catch (err: any) {
      setStatus(`Failed to fetch git status: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handlePush = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setPushing(true);
    setError(null);
    setOutput(null);

    try {
      const res = await fetch('/api/admin/git', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Failed to push');
        setOutput({ stdout: data.stdout || '', stderr: data.stderr || '' });
      } else {
        setOutput({ stdout: data.output || '', stderr: data.errorOutput || '' });
        setMessage(''); // clear message on success
        fetchStatus(); // refresh status
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during push');
    } finally {
      setPushing(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto w-full max-w-5xl mx-auto px-4 py-8 md:px-8 custom-scrollbar">
      <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
              <Github size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-purple)' }} />
              GitHub Sync
            </h1>
            <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
              Commit and push your local codebase directly to GitHub.
            </p>
          </div>
          <Button variant="secondary" onClick={fetchStatus} disabled={loading || pushing}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh Status
          </Button>
        </div>

        {/* Current Status */}
        <Card padding="lg">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-3)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <Terminal size={18} color="var(--text-tertiary)" />
            Local Git Status
          </h3>
          <div style={{ 
            background: '#0d1117', 
            color: '#c9d1d9', 
            padding: 'var(--sp-4)', 
            borderRadius: 'var(--radius-md)', 
            fontFamily: 'monospace',
            fontSize: 'var(--fs-sm)',
            whiteSpace: 'pre-wrap',
            maxHeight: '300px',
            overflowY: 'auto'
          }}>
            {status}
          </div>
        </Card>

        {/* Commit Form */}
        <Card padding="lg" variant="glow">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            <GitCommit size={18} color="var(--accent-cyan)" />
            Commit & Push
          </h3>
          <form onSubmit={handlePush} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Input 
              name="message" 
              label="Commit Message" 
              placeholder="e.g., feat: added github sync panel" 
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required 
              disabled={pushing}
            />
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
              <Button type="submit" disabled={pushing || !message.trim()} style={{ background: 'var(--accent-purple)', color: '#fff' }}>
                {pushing ? <Loader2 size={16} className="spin" /> : <Github size={16} />}
                {pushing ? 'Pushing to GitHub...' : 'Commit & Push'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Output Log */}
        {(output || error) && (
          <Card padding="lg" style={{ border: error ? '1px solid var(--danger-dim)' : '1px solid var(--success-dim)' }}>
            <h3 style={{ 
              fontSize: 'var(--fs-md)', 
              fontWeight: 'var(--fw-semibold)', 
              marginBottom: 'var(--sp-3)', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 'var(--sp-2)',
              color: error ? 'var(--danger)' : 'var(--success)'
            }}>
              {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              {error ? 'Push Failed' : 'Push Successful'}
            </h3>
            
            {error && (
              <div style={{ marginBottom: 'var(--sp-3)', color: 'var(--danger)' }}>
                {error}
              </div>
            )}
            
            <div style={{ 
              background: '#0d1117', 
              color: '#c9d1d9', 
              padding: 'var(--sp-4)', 
              borderRadius: 'var(--radius-md)', 
              fontFamily: 'monospace',
              fontSize: 'var(--fs-xs)',
              whiteSpace: 'pre-wrap',
              maxHeight: '400px',
              overflowY: 'auto'
            }}>
              {output?.stdout && <div>{output.stdout}</div>}
              {output?.stderr && <div style={{ color: '#8b949e', marginTop: '8px' }}>{output.stderr}</div>}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}
