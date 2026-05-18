'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { uploadNotes } from '@/lib/actions/knowledge';
import { Database, Plus, FileText, Loader2, Sparkles } from 'lucide-react';

export default function KnowledgeBaseUI({ initialMaterials }: { initialMaterials: any[] }) {
  const [materials, setMaterials] = useState(initialMaterials);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const formData = new FormData(e.currentTarget);
    
    try {
      const response = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      });
      const res = await response.json();
      
      if (!response.ok || res.error) {
        setStatus({ type: 'error', msg: res.error || 'Upload failed' });
      } else {
        setStatus({ type: 'success', msg: `Successfully processed into ${res.chunks} AI memory chunks!` });
        setShowForm(false);
        window.location.reload(); 
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Network error occurred' });
    }
    setLoading(false);
  }

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
            <Database size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-cyan)' }} />
            Personal Knowledge Base
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            Upload your lecture notes. The AI will embed them into your personalized memory.
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Add Material
        </Button>
      </div>

      {status && (
        <div style={{
          padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
          background: status.type === 'error' ? 'var(--danger-glow)' : 'var(--success-glow)',
          color: status.type === 'error' ? 'var(--danger)' : 'var(--success)',
          border: `1px solid ${status.type === 'error' ? 'var(--danger-dim)' : 'var(--success-dim)'}`
        }}>
          {status.msg}
        </div>
      )}

      {/* Upload Form */}
      {showForm && (
        <Card padding="lg" variant="glow" className="animate-fade">
          <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
            Ingest New Knowledge
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Input name="title" label="Document Title" placeholder="e.g. Chapter 4: Thermodynamics Notes" required />
            
            <div>
              <label style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', display: 'block', marginBottom: 'var(--sp-1)' }}>
                File Upload (PDF, TXT, MD)
              </label>
              <input 
                type="file"
                name="file" 
                required
                accept=".txt,.md,.pdf"
                style={{
                  width: '100%', padding: 'var(--sp-3)', background: 'var(--bg-primary)',
                  color: 'var(--text-primary)', border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-base)', fontFamily: 'var(--font-sans)',
                }} 
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-3)', marginTop: 'var(--sp-2)' }}>
              <Button variant="ghost" type="button" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" disabled={loading} style={{ background: 'var(--accent-cyan)', color: '#000' }}>
                {loading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {loading ? 'Embedding via Gemini...' : 'Process & Embed'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Uploaded Materials List */}
      <Card>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
          Ingested Brain Data
        </h3>
        {materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>
            <Database size={48} style={{ opacity: 0.2, margin: '0 auto var(--sp-4)' }} />
            <p>Your personal knowledge base is empty.</p>
            <p style={{ fontSize: 'var(--fs-sm)' }}>Paste notes above to train your AI.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {materials.map((mat) => (
              <div key={mat.id} style={{
                display: 'flex', alignItems: 'center', padding: 'var(--sp-3)',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', gap: 'var(--sp-3)'
              }}>
                <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>{mat.title}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    Ingested on {new Date(mat.created_at).toLocaleDateString()}
                  </div>
                </div>
                <Badge color="cyan">Vectorized</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
