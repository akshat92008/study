'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Database, Plus, FileText, Loader2, Sparkles, Headphones, RefreshCw } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { useAppStore } from '@/stores/appStore';

export default function KnowledgeBaseUI({ initialMaterials }: { initialMaterials: any[] }) {
  const { activeGoalId, chatId, learningGoals } = useAppStore();
  const [materials, setMaterials] = useState(initialMaterials);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info', msg: string } | null>(null);
  const [audioResponse, setAudioResponse] = useState<{ script: string; audioDataUrl: string | null; materialTitle: string } | null>(null);
  const [generatingPodcastId, setGeneratingPodcastId] = useState<string | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<{title: string, file: File, activeGoalTitle: string, fileSub: string, goalSub: string} | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const activeGoal = learningGoals.find(goal => goal.id === activeGoalId);

  const loadMaterials = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeGoalId) params.set('goalId', activeGoalId);
    const response = await fetch(`/api/materials${params.toString() ? `?${params.toString()}` : ''}`);
    if (!response.ok) return;
    const data = await response.json();
    setMaterials(prev => {
      const newMaterials = data.materials || [];
      const previouslyPending = prev.filter(m => !['ready', 'failed'].includes(m.status)).map(m => m.id);
      const newlyReady = newMaterials.some((m: any) => m.status === 'ready' && previouslyPending.includes(m.id));
      if (newlyReady) {
        window.dispatchEvent(new Event('refresh-goal-context'));
      }
      return newMaterials;
    });
  }, [activeGoalId]);

  useEffect(() => {
    loadMaterials().catch(() => {});
  }, [loadMaterials]);

  useEffect(() => {
    const hasPending = materials.some(m => m.status === 'queued' || m.status === 'processing');
    if (!hasPending) return;
    const interval = setInterval(() => {
      loadMaterials().catch(() => {});
    }, 3000);
    return () => clearInterval(interval);
  }, [materials, loadMaterials]);

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

  async function handleReprocess(materialId: string) {
    setReprocessingId(materialId);
    setStatus(null);
    try {
      const response = await fetch(`/api/materials/${materialId}/reprocess`, {
        method: 'POST',
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.error) {
        setStatus({ type: 'error', msg: data?.message || data?.error || 'Unable to process this source.' });
        return;
      }

      if (data.status === 'ready' && (data.chunksProcessed ?? 0) > 0) {
        setStatus({ type: 'success', msg: `Source ready: ${data.chunksProcessed} chunks indexed.` });
      } else if (data.status === 'ready' && (data.chunksProcessed ?? 0) === 0) {
        setStatus({ type: 'error', msg: 'Source processed but no searchable text was found. This source may be a scanned image. Try a text-based PDF or re-upload with OCR.' });
      } else if (data.status === 'failed') {
        setStatus({ type: 'error', msg: 'Material indexing failed. Try another file or re-upload this source.' });
      } else {
        setStatus({ type: 'info', msg: 'Source is queued for indexing. Amaura will use it once chunks are ready.' });
      }

      await loadMaterials();
      window.dispatchEvent(new Event('refresh-dashboard'));
      window.dispatchEvent(new Event('refresh-goal-context'));
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Error processing source' });
    } finally {
      setReprocessingId(null);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const formData = new FormData(e.currentTarget);
    if (activeGoalId) formData.set('goalId', activeGoalId);
    if (chatId) formData.set('chatSessionId', chatId);

    if (activeGoal) {
      const title = formData.get('title') as string || '';
      const file = formData.get('file') as File;
      const fileText = (title + ' ' + (file?.name || '')).toLowerCase();
      const goalText = activeGoal.title.toLowerCase();
      
      const detectSubject = (text: string) => {
        if (text.includes('physics')) return 'Physics';
        if (text.includes('chemistry')) return 'Chemistry';
        if (text.includes('biology') || text.includes('biotech') || text.includes('botany') || text.includes('zoology')) return 'Biology';
        return null;
      };

      const fileSub = detectSubject(fileText);
      const goalSub = detectSubject(goalText);

      if (fileSub && goalSub && fileSub !== goalSub) {
        setMismatchWarning({ title: title || file.name, file, activeGoalTitle: activeGoal.title, fileSub, goalSub });
        setPendingFormData(formData);
        setLoading(false);
        return;
      }
    }
    
    await processUpload(formData);
  }

  async function processUpload(formData: FormData) {
    setLoading(true);
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
      } else if (res.material?.status === 'ready' && (res.chunksProcessed ?? 0) > 0) {
        setStatus({ type: 'success', msg: `Source ready: ${res.chunksProcessed} chunks indexed.` });
        setShowForm(false);
        await loadMaterials();
      } else if (res.material?.status === 'ready' && (res.chunksProcessed ?? 0) === 0) {
        setStatus({ type: 'error', msg: 'Source uploaded but no searchable text was found. This may be a scanned image. Try a text-based PDF.' });
      } else {
        setStatus({ type: 'info', msg: 'Source uploaded and queued for indexing. Use Process now if it stays queued.' });
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

      {mismatchWarning && (
        <div style={{
          padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)',
          border: '1px solid rgba(245, 158, 11, 0.35)', marginBottom: 'var(--sp-4)'
        }}>
          <h4 style={{ fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Potential Subject Mismatch</h4>
          <p style={{ marginBottom: 'var(--sp-3)' }}>
            This source appears to be related to <strong>Physics/Chemistry/Biology</strong>, but your active goal is <strong>{mismatchWarning.activeGoalTitle}</strong>.
            Are you sure you want to attach it?
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <Button variant="ghost" onClick={() => { setMismatchWarning(null); setPendingFormData(null); }}>
              Cancel
            </Button>
            <Button style={{ background: 'var(--warning)', color: '#000' }} onClick={() => {
              if (pendingFormData) {
                pendingFormData.set('detectedSubject', mismatchWarning.fileSub);
                pendingFormData.set('detectedGoalSubject', mismatchWarning.goalSub);
                pendingFormData.set('mismatchWarningAcknowledged', 'true');
                processUpload(pendingFormData);
              }
              setMismatchWarning(null);
            }}>
              Attach Anyway
            </Button>
          </div>
        </div>
      )}

      {status && (
        (() => {
          const palette = status.type === 'error'
            ? { background: 'var(--danger-glow)', color: 'var(--danger)', border: 'var(--danger-dim)' }
            : status.type === 'success'
              ? { background: 'var(--success-glow)', color: 'var(--success)', border: 'var(--success-dim)' }
              : { background: 'rgba(20,184,166,0.1)', color: 'var(--accent-cyan)', border: 'rgba(20,184,166,0.35)' };

          return (
        <div style={{
          padding: 'var(--sp-3)', borderRadius: 'var(--radius-md)',
          background: palette.background,
          color: palette.color,
          border: `1px solid ${palette.border}`
        }}>
          {status.msg}
        </div>
          );
        })()
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
                {loading ? 'Uploading...' : 'Process Source'}
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
          <div style={{ textAlign: 'center', padding: 'var(--sp-12)', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--border-default)' }}>
            <Database size={48} style={{ opacity: 0.3, margin: '0 auto var(--sp-4)', color: 'var(--text-secondary)' }} />
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Start Here: Add Your First Source</h2>
            <p style={{ color: 'var(--text-tertiary)', marginBottom: 'var(--sp-6)' }}>Upload notes or study materials to ground the AI tutor for this goal.</p>
            <Button onClick={() => setShowForm(true)} style={{ background: 'var(--accent-cyan)', color: '#000', padding: '12px 24px' }}>
              <Plus size={18} style={{ marginRight: 8 }} /> Upload Material
            </Button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
            {materials.map((mat) => (
              <div key={mat.id} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', padding: 'var(--sp-3)',
                background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', gap: 'var(--sp-3)',
                transition: 'all 0.3s ease',
                ...(mat.status === 'processing' || mat.status === 'queued' ? {
                  background: 'linear-gradient(90deg, var(--bg-tertiary) 0%, rgba(139, 92, 246, 0.05) 50%, var(--bg-tertiary) 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 2s infinite linear'
                } : {}),
                ...(mat.status === 'ready' ? {
                  boxShadow: '0 0 10px rgba(6, 182, 212, 0.15)'
                } : {})
              }}>
                <FileText size={18} style={{ color: 'var(--accent-cyan)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>{mat.original_filename || mat.title}</div>
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
                  {mat.status !== 'ready' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={reprocessingId !== null}
                      onClick={() => handleReprocess(mat.id)}
                    >
                      {reprocessingId === mat.id ? (
                        <>
                          <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Processing...
                        </>
                      ) : (
                        <>
                          <RefreshCw size={14} /> Process now
                        </>
                      )}
                    </Button>
                  )}
                  <Badge color={mat.status === 'ready' ? 'cyan' : mat.status === 'failed' ? 'red' : 'yellow'}>
                    {mat.status === 'ready' ? 'Ready' : mat.status === 'failed' ? 'Failed' : mat.status === 'uploaded' ? 'Uploaded' : mat.status === 'queued' ? 'Queued' : 'Processing'}
                  </Badge>
                  <Badge color="gray">
                    {mat.source_type?.toUpperCase() || (mat.mime_type?.includes('pdf') ? 'PDF' : 'TXT')}
                  </Badge>
                  {mat.study_material_chunks?.[0]?.count > 0 && (
                    <Badge color="purple">{mat.study_material_chunks[0].count} chunks</Badge>
                  )}
                </div>
              </div>
              {mat.status === 'failed' && (mat.error_message || mat.last_error) && (
                <div style={{ padding: 'var(--sp-2) var(--sp-3)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: 'var(--fs-sm)', borderRadius: 'var(--radius-md)' }}>
                  <strong>Error:</strong> {mat.error_message || mat.last_error}
                  <div style={{ fontSize: 'var(--fs-xs)', opacity: 0.8, marginTop: '2px' }}>
                    Retryable: {mat.retryable ? 'Yes' : 'No'} {mat.next_retry_at ? `| Next Retry: ${new Date(mat.next_retry_at).toLocaleString()}` : ''}
                  </div>
                </div>
              )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
