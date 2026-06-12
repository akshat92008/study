'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { FileText, Trash2, Loader2, BookOpen, RotateCcw, LayoutDashboard } from 'lucide-react';
import SourceDashboardModal from './SourceDashboardModal';

export default function StudyMaterialPanel() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<any | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const fetchMaterials = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('study_materials')
      .select('id, title, status, subject, chapter, error_message, retryable, deep_processing_status, briefing_doc, podcast_transcript, original_filename, mime_type, source_type, study_material_chunks(count)')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      setMaterials(data);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchMaterials();
    const intervalId = setInterval(fetchMaterials, 5000);
    return () => clearInterval(intervalId);
  }, [fetchMaterials]);

  async function handleRemove(id: string) {
    setMaterials(prev => prev.filter(m => m.id !== id));
    await supabase.from('study_materials').update({ status: 'archived' }).eq('id', id);
  }

  async function handleRetry(id: string) {
    setRetryingId(id);
    try {
      const response = await fetch(`/api/materials/${id}/reprocess`, { method: 'POST' });
      if (response.ok) {
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, status: 'queued', retryable: false, error_message: null } : m));
      }
    } finally {
      setRetryingId(null);
    }
  }

  if (loading || materials.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
      <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <BookOpen size={16} /> Active Sources
      </h3>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '-4px' }}>
        The AI Tutor will automatically use these sources when answering questions.
      </p>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '-6px' }}>
        Ask the AI Tutor: "answer from my uploaded notes."
      </p>
      
      {materials.map(mat => (
        <Card key={mat.id} padding="sm" style={{ 
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', 
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' 
        }}>
          <FileText size={16} style={{ color: mat.status === 'ready' ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }} />
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {mat.original_filename || mat.title}
            </div>
            {(mat.subject || mat.chapter) && (
              <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>
                {mat.subject} {mat.chapter ? `· ${mat.chapter}` : ''}
              </div>
            )}
            {mat.status === 'failed' && (
              <div style={{ fontSize: '10px', color: 'var(--danger)' }}>{mat.error_message || 'Indexing failed'}</div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {mat.status === 'processing' ? (
              <Badge color="yellow"><Loader2 size={10} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />Extracting text...</Badge>
            ) : mat.status === 'parsed' ? (
              <Badge color="yellow"><Loader2 size={10} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />Preparing chunks...</Badge>
            ) : mat.status === 'embedding' ? (
              <Badge color="yellow"><Loader2 size={10} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />Generating embeddings...</Badge>
            ) : mat.status === 'queued' ? (
              <Badge color="yellow">Waiting in queue...</Badge>
            ) : mat.status === 'uploaded' ? (
              <Badge color="gray">Uploaded</Badge>
            ) : mat.status === 'failed' ? (
              <Badge color="red">Failed</Badge>
            ) : mat.status === 'needs_user_action' ? (
              <Badge color="red">Action Required</Badge>
            ) : (
              <Badge color="cyan">Ready</Badge>
            )}

            <Badge color="gray">
              {mat.source_type?.toUpperCase() || (mat.mime_type?.includes('pdf') ? 'PDF' : 'TXT')}
            </Badge>

            {mat.study_material_chunks?.[0]?.count > 0 && (
              <Badge color="purple">{mat.study_material_chunks[0].count} chunks</Badge>
            )}

            {mat.deep_processing_status === 'completed' && (
              <button
                onClick={() => setSelectedMaterial(mat)}
                style={{ background: 'transparent', border: '1px solid var(--accent-purple)', borderRadius: '4px', cursor: 'pointer', color: 'var(--accent-purple)', padding: '2px 8px', fontSize: '10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                title="View Deep Dive"
              >
                <LayoutDashboard size={12} /> Deep Dive
              </button>
            )}

            {mat.status === 'failed' && mat.retryable !== false && (
              <button
                onClick={() => handleRetry(mat.id)}
                disabled={retryingId === mat.id}
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
                title="Retry indexing"
              >
                {retryingId === mat.id ? <Loader2 size={14} className="animate-spin" /> : <RotateCcw size={14} />}
              </button>
            )}
            
            <button 
              onClick={() => handleRemove(mat.id)}
              style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-tertiary)', padding: 4 }}
              title="Remove Material"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </Card>
      ))}

      {selectedMaterial && (
        <SourceDashboardModal 
          material={selectedMaterial} 
          onClose={() => setSelectedMaterial(null)} 
        />
      )}
    </div>
  );
}
