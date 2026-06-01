'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { FileText, Trash2, Loader2, BookOpen } from 'lucide-react';

export default function StudyMaterialPanel() {
  const [materials, setMaterials] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    fetchMaterials();
    const intervalId = setInterval(fetchMaterials, 5000);
    return () => clearInterval(intervalId);
  }, []);

  async function fetchMaterials() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    
    const { data } = await supabase
      .from('study_materials')
      .select('id, title, status, subject, chapter, error_message')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .order('created_at', { ascending: false })
      .limit(5);
      
    if (data) {
      setMaterials(data);
    }
    setLoading(false);
  }

  async function handleRemove(id: string) {
    setMaterials(prev => prev.filter(m => m.id !== id));
    await supabase.from('study_materials').update({ status: 'archived' }).eq('id', id);
  }

  if (loading || materials.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
      <h3 style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
        <BookOpen size={16} /> Active Study Materials
      </h3>
      <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', marginTop: '-4px' }}>
        MIND will automatically use these sources when answering questions.
      </p>
      
      {materials.map(mat => (
        <Card key={mat.id} padding="sm" style={{ 
          display: 'flex', alignItems: 'center', gap: 'var(--sp-3)', 
          background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' 
        }}>
          <FileText size={16} style={{ color: mat.status === 'ready' ? 'var(--accent-cyan)' : 'var(--text-tertiary)' }} />
          
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'bold', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {mat.title}
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
            {mat.status === 'processing' || mat.status === 'uploaded' ? (
              <Badge color="yellow"><Loader2 size={10} className="animate-spin" style={{ display: 'inline', marginRight: 4 }} />Processing</Badge>
            ) : mat.status === 'failed' ? (
              <Badge color="red">Failed</Badge>
            ) : (
              <Badge color="cyan">Ready</Badge>
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
    </div>
  );
}
