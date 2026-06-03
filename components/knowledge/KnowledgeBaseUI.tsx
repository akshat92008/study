'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Database, Plus, FileText, Loader2, Sparkles, Headphones } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { useAppStore } from '@/stores/appStore';

export default function KnowledgeBaseUI({ initialMaterials }: { initialMaterials: any[] }) {
  const { activeGoalId, chatId, learningGoals } = useAppStore();
  const [materials, setMaterials] = useState(initialMaterials);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success', msg: string } | null>(null);
  const [audioResponse, setAudioResponse] = useState<{ script: string; audioDataUrl: string | null; materialTitle: string } | null>(null);
  const [generatingPodcastId, setGeneratingPodcastId] = useState<string | null>(null);
  const activeGoal = learningGoals.find(goal => goal.id === activeGoalId);

  const loadMaterials = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeGoalId) params.set('goalId', activeGoalId);
    const response = await fetch(`/api/materials${params.toString() ? `?${params.toString()}` : ''}`);
    if (!response.ok) return;
    const data = await response.json();
    setMaterials(data.materials || []);
  }, [activeGoalId]);

  useEffect(() => {
    loadMaterials().catch(() => {});
  }, [loadMaterials]);

  async function handleGeneratePodcast(materialId: string) {
    setGeneratingPodcastId(materialId);
    setStatus(null);
    try {
      const response = await fetch('/api/knowledge/audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materialId }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setStatus({ type: 'error', msg: data.error || 'Failed to generate podcast' });
      } else {
        setAudioResponse({
          script: data.script,
          audioDataUrl: data.audioDataUrl,
          materialTitle: data.materialTitle,
        });
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Error generating podcast' });
    } finally {
      setGeneratingPodcastId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const formData = new FormData(e.currentTarget);
    if (activeGoalId) formData.set('goalId', activeGoalId);
    if (chatId) formData.set('chatSessionId', chatId);
    
    try {
      const response = await fetch('/api/materials/upload', {
        method: 'POST',
        body: formData,
      });
      let res;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        res = await response.json();
      } else {
        if (response.status === 413) {
          setStatus({ type: 'error', msg: 'File is too large. Max file size is 4MB.' });
        } else {
          setStatus({ type: 'error', msg: `Upload failed: ${response.status} ${response.statusText}` });
        }
        setLoading(false);
        return;
      }
      
      if (!response.ok || res.error) {
        setStatus({ type: 'error', msg: res.error || 'Upload failed' });
      } else if (res.material?.status === 'failed') {
        setStatus({ type: 'error', msg: 'Material indexing failed.' });
      } else {
        setStatus({ type: 'success', msg: `Source ready: ${res.chunksProcessed || 0} chunks indexed.` });
        setShowForm(false);
        await loadMaterials();
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
            Sources
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
            {activeGoal ? `Sources attached to ${activeGoal.title}.` : 'Upload lecture notes so the AI tutor can ground explanations in your materials.'}
          </p>
        </div>
        <Button onClick={() => setShowForm(!showForm)}>
          <Plus size={16} /> Add Source
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
            Add Source
          </h3>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <Input name="title" label="Source Title" placeholder="e.g. Chapter 4: Thermodynamics Notes" required />
            
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
                {loading ? 'Processing...' : 'Process Source'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {audioResponse && (
        <AudioPlayer
          script={audioResponse.script}
          audioDataUrl={audioResponse.audioDataUrl}
          materialTitle={audioResponse.materialTitle}
        />
      )}

      {/* Uploaded Materials List */}
      <Card>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
          Uploaded Sources
        </h3>
        {materials.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-8)', color: 'var(--text-tertiary)' }}>
            <Database size={48} style={{ opacity: 0.2, margin: '0 auto var(--sp-4)' }} />
            <p>No sources uploaded yet.</p>
            <p style={{ fontSize: 'var(--fs-sm)' }}>Add notes to ground the AI tutor for this goal.</p>
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
                    Uploaded on {new Date(mat.created_at).toLocaleDateString()}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={generatingPodcastId !== null || mat.status !== 'ready'}
                    onClick={() => handleGeneratePodcast(mat.id)}
                  >
                    {generatingPodcastId === mat.id ? (
                      <>
                        <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Generating...
                      </>
                    ) : (
                      <>
                        <Headphones size={14} /> Listen
                      </>
                    )}
                  </Button>
                  <Badge color={mat.status === 'ready' ? 'cyan' : mat.status === 'failed' ? 'red' : 'yellow'}>
                    {mat.status === 'ready' ? 'Ready' : mat.status === 'failed' ? 'Failed' : 'Processing'}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
