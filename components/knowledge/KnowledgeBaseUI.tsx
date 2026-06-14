'use client';

import { useCallback, useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Badge from '@/components/ui/Badge';
import { Database, Plus, FileText, Loader2, Sparkles, Headphones, RefreshCw, Trash2 } from 'lucide-react';
import { AudioPlayer } from './AudioPlayer';
import { useAppStore } from '@/stores/appStore';
import { classifySource } from '@/lib/materials/classify-source';

export default function KnowledgeBaseUI({ initialMaterials }: { initialMaterials: any[] }) {
  const { activeGoalId, chatId, learningGoals, selectedMaterialIds, toggleSelectedMaterial } = useAppStore();
  const [materials, setMaterials] = useState(initialMaterials);
  const [showForm, setShowForm] = useState(false);
  const [showUrlForm, setShowUrlForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'error' | 'success' | 'info', msg: string } | null>(null);
  const [audioResponse, setAudioResponse] = useState<{ script: string; audioDataUrl: string | null; materialTitle: string } | null>(null);
  const [generatingPodcastId, setGeneratingPodcastId] = useState<string | null>(null);
  const [generatingGuideId, setGeneratingGuideId] = useState<string | null>(null);
  const [guideData, setGuideData] = useState<{ title: string; guide: any } | null>(null);
  const [reprocessingId, setReprocessingId] = useState<string | null>(null);
  const [mismatchWarning, setMismatchWarning] = useState<{title: string, file: File, activeGoalTitle: string, fileSub: string, fileChapter: string | null, goalSub: string, message: string} | null>(null);
  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);
  const [notes, setNotes] = useState<any[]>([]);
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

  const loadNotes = useCallback(async () => {
    const params = new URLSearchParams();
    if (activeGoalId) params.set('goalId', activeGoalId);
    const response = await fetch(`/api/notes${params.toString() ? `?${params.toString()}` : ''}`);
    if (!response.ok) return;
    const data = await response.json();
    setNotes(data.notes || []);
  }, [activeGoalId]);

  useEffect(() => {
    loadMaterials().catch(() => {});
    loadNotes().catch(() => {});
    const handleRefreshNotes = () => loadNotes().catch(() => {});
    window.addEventListener('refresh-notes', handleRefreshNotes);
    return () => window.removeEventListener('refresh-notes', handleRefreshNotes);
  }, [loadMaterials, loadNotes]);

  useEffect(() => {
    const hasPending = materials.some(m => ['uploaded', 'queued', 'processing'].includes(m.status));
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

  async function handleGenerateGuide(materialId: string, title: string) {
    setGeneratingGuideId(materialId);
    setStatus(null);
    try {
      const response = await fetch(`/api/materials/${materialId}/guide`);
      const data = await response.json();
      if (!response.ok || data.error) {
        setStatus({ type: 'error', msg: data.error || 'Failed to generate guide' });
      } else {
        setGuideData({ title, guide: data.guide });
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Error generating guide' });
    } finally {
      setGeneratingGuideId(null);
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
      if (!response.ok || data?.ok === false) {
        setStatus({ type: 'error', msg: `${data?.message || 'Unable to process this source.'}${data?.errorCode ? ` (${data.errorCode})` : ''}` });
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

  async function handleDeleteNote(id: string) {
    try {
      await fetch(`/api/notes?id=${id}`, { method: 'DELETE' });
      await loadNotes();
    } catch (e) {
      console.error(e);
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
      const classification = classifySource({ filename: file?.name, title, activeGoal });
      const goalSub = classification.mismatch ? (activeGoal.subject || 'Biology') : null;

      if (classification.mismatch && classification.detectedSubject && goalSub) {
        setMismatchWarning({
          title: title || file.name,
          file,
          activeGoalTitle: activeGoal.title,
          fileSub: classification.detectedSubject,
          fileChapter: classification.detectedChapter,
          goalSub,
          message: classification.warningMessage || 'This source may not match the active goal.',
        });
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
        if (res.errorCode === 'source_goal_mismatch' && res.classification) {
          const file = formData.get('file') as File;
          setPendingFormData(formData);
          setMismatchWarning({
            title: String(formData.get('title') || file.name),
            file,
            activeGoalTitle: activeGoal?.title || 'active goal',
            fileSub: res.classification.detectedSubject,
            fileChapter: res.classification.detectedChapter,
            goalSub: activeGoal?.subject || 'Biology',
            message: res.message,
          });
        } else {
          setStatus({ type: 'error', msg: res.message || res.error || 'Upload failed' });
        }
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
      setStatus({ type: 'error', msg: err.message || 'Error uploading file' });
    } finally {
      setLoading(false);
    }
  }

  async function handleUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setStatus(null);
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;
    const title = formData.get('title') as string;

    try {
      const response = await fetch('/api/materials/ingest-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, goalId: activeGoalId }),
      });
      const data = await response.json();
      if (!response.ok || data.error) {
        setStatus({ type: 'error', msg: data.error || 'Failed to ingest URL' });
      } else {
        setStatus({ type: 'success', msg: 'URL added successfully! It is being processed.' });
        setShowUrlForm(false);
        await loadMaterials();
      }
    } catch (err: any) {
      setStatus({ type: 'error', msg: err.message || 'Error ingesting URL' });
    } finally {
      setLoading(false);
    }
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
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <Button variant="secondary" onClick={() => { setShowForm(!showForm); setShowUrlForm(false); }}>
            <Plus size={16} /> Add File
          </Button>
          <Button variant="secondary" onClick={() => { setShowUrlForm(!showUrlForm); setShowForm(false); }}>
            <Plus size={16} /> Add Link
          </Button>
        </div>
      </div>

      {mismatchWarning && (
        <div style={{
          padding: 'var(--sp-4)', borderRadius: 'var(--radius-md)',
          background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)',
          border: '1px solid rgba(245, 158, 11, 0.35)', marginBottom: 'var(--sp-4)'
        }}>
          <h4 style={{ fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-2)' }}>Potential Subject Mismatch</h4>
          <p style={{ marginBottom: 'var(--sp-3)' }}>
            {mismatchWarning.message}
          </p>
          <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
            <Button variant="ghost" onClick={() => { setMismatchWarning(null); setPendingFormData(null); }}>
              Cancel
            </Button>
            <Button style={{ background: 'var(--warning)', color: '#000' }} onClick={() => {
              if (pendingFormData) {
                pendingFormData.set('detectedSubject', mismatchWarning.fileSub);
                if (mismatchWarning.fileChapter) pendingFormData.set('detectedChapter', mismatchWarning.fileChapter);
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

      {showUrlForm && (
        <Card>
          <form onSubmit={handleUrlSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)' }}>Add Web Link</h3>
            
            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-2)', color: 'var(--text-secondary)' }}>
                URL *
              </label>
              <Input
                name="url"
                type="url"
                placeholder="https://example.com/article"
                required
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)', marginBottom: 'var(--sp-2)', color: 'var(--text-secondary)' }}>
                Title (Optional)
              </label>
              <Input
                name="title"
                placeholder="Custom title for this link"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: 'var(--sp-3)', justifyContent: 'flex-end', marginTop: 'var(--sp-2)' }}>
              <Button type="button" variant="ghost" onClick={() => setShowUrlForm(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={loading}>
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Ingest Link'}
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
          <span style={{ fontSize: 'var(--fs-xs)', fontWeight: 'normal', color: 'var(--text-tertiary)', marginLeft: '8px' }}>
            {selectedMaterialIds.length > 0 ? `${selectedMaterialIds.length} selected for chat` : 'All ready sources included in chat'}
          </span>
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
                  boxShadow: selectedMaterialIds.includes(mat.id) ? '0 0 10px rgba(6, 182, 212, 0.3)' : '0 0 10px rgba(6, 182, 212, 0.05)',
                  border: selectedMaterialIds.includes(mat.id) ? '1px solid var(--accent-cyan)' : '1px solid transparent'
                } : {})
              }}>
                {mat.status === 'ready' && (
                  <input
                    type="checkbox"
                    checked={selectedMaterialIds.includes(mat.id)}
                    onChange={() => toggleSelectedMaterial(mat.id)}
                    style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--accent-cyan)' }}
                    title="Include in AI Chat context"
                  />
                )}
                <FileText size={18} style={{ color: mat.status === 'ready' && selectedMaterialIds.includes(mat.id) ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>{mat.original_filename || mat.title}</div>
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                    Uploaded on {new Date(mat.created_at).toLocaleDateString()}
                  </div>
                  {(mat.detected_subject || mat.detected_chapter) && (
                    <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)', marginTop: 2 }}>
                      Detected: {[mat.detected_subject, mat.detected_chapter].filter(Boolean).join(' / ')}
                    </div>
                  )}
                  <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {mat.chunk_count ?? mat.study_material_chunks?.[0]?.count ?? 0} chunks
                    {' · '}{mat.embedding_count ?? 0} embeddings
                    {' · '}retry {mat.retry_count ?? 0}
                    {mat.last_processed_at ? ` · processed ${new Date(mat.last_processed_at).toLocaleString()}` : ''}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={generatingGuideId !== null || mat.status !== 'ready'}
                    onClick={() => handleGenerateGuide(mat.id, mat.original_filename || mat.title)}
                  >
                    {generatingGuideId === mat.id ? (
                      <>
                        <Loader2 size={14} className="spin" style={{ animation: 'spin 1s linear infinite' }} /> Generating...
                      </>
                    ) : (
                      <>
                        <FileText size={14} /> Guide
                      </>
                    )}
                  </Button>
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
                  {!['ready', 'processing', 'queued'].includes(mat.status) && (
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
                  <Badge color={mat.status === 'ready' ? 'cyan' : ['failed', 'retryable_failed'].includes(mat.status) ? 'red' : 'yellow'}>
                    {mat.status === 'ready' ? 'Ready' : mat.status === 'failed' ? 'Failed' : mat.status === 'retryable_failed' ? 'Retry available' : mat.status === 'uploaded' ? 'Uploaded' : mat.status === 'queued' ? 'Queued' : 'Processing'}
                  </Badge>
                  <Badge color="gray">
                    {mat.source_type?.toUpperCase() || (mat.mime_type?.includes('pdf') ? 'PDF' : 'TXT')}
                  </Badge>
                  {mat.study_material_chunks?.[0]?.count > 0 && (
                    <Badge color="purple">{mat.study_material_chunks[0].count} chunks</Badge>
                  )}
                </div>
              </div>
              {['failed', 'retryable_failed'].includes(mat.status) && (mat.error_message || mat.last_error) && (
                <div style={{ padding: 'var(--sp-2) var(--sp-3)', background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)', fontSize: 'var(--fs-sm)', borderRadius: 'var(--radius-md)' }}>
                  <strong>Error{mat.last_error_code ? ` (${mat.last_error_code})` : ''}:</strong> {mat.error_message || mat.last_error}
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

      {/* Saved Notes List */}
      <Card>
        <h3 style={{ fontSize: 'var(--fs-md)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)' }}>
          Saved Notes
        </h3>
        {notes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 'var(--sp-6)', color: 'var(--text-tertiary)' }}>
            No saved notes yet. You can pin important concepts from the AI chat.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {notes.map(note => (
              <div key={note.id} style={{ padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.5, flex: 1, paddingRight: 'var(--sp-3)' }}>
                  {note.content}
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteNote(note.id)} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Guide Modal */}
      {guideData && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 'var(--sp-4)'
        }}>
          <Card padding="lg" style={{ maxWidth: '600px', width: '100%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: 'var(--fs-xl)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)', color: 'var(--text-primary)' }}>
              Source Guide: {guideData.title}
            </h2>
            
            <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--accent-cyan)', marginBottom: 'var(--sp-2)' }}>Summary</h3>
            <p style={{ marginBottom: 'var(--sp-4)' }}>{guideData.guide.summary}</p>
            
            <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--accent-cyan)', marginBottom: 'var(--sp-2)' }}>Key Concepts</h3>
            <ul style={{ marginBottom: 'var(--sp-4)', paddingLeft: 'var(--sp-4)' }}>
              {guideData.guide.keyConcepts?.map((kc: any, i: number) => (
                <li key={i} style={{ marginBottom: 'var(--sp-2)' }}>
                  <strong>{kc.term}</strong>: {kc.definition}
                </li>
              ))}
            </ul>
            
            <h3 style={{ fontSize: 'var(--fs-lg)', color: 'var(--accent-cyan)', marginBottom: 'var(--sp-2)' }}>FAQs</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)' }}>
              {guideData.guide.faqs?.map((faq: any, i: number) => (
                <div key={i} style={{ padding: 'var(--sp-3)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                  <p style={{ fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-1)' }}>Q: {faq.question}</p>
                  <p>A: {faq.answer}</p>
                </div>
              ))}
            </div>

            <Button onClick={() => setGuideData(null)} style={{ width: '100%' }}>Close Guide</Button>
          </Card>
        </div>
      )}
    </div>
  );
}
