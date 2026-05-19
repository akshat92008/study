'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import { RotateCcw, Pencil, Trash2, Flag } from 'lucide-react';

interface FlashCardProps {
  front: string;
  back: string;
  cardId?: string;
  cardIndex: number;
  totalCards: number;
  onRate: (rating: 'again' | 'hard' | 'good' | 'easy') => void;
}

export default function FlashCard({ front, back, cardId, cardIndex, totalCards, onRate }: FlashCardProps) {
  const [flipped, setFlipped] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editFront, setEditFront] = useState(front);
  const [editBack, setEditBack] = useState(back);
  const [actionLoading, setActionLoading] = useState(false);
  const [flagged, setFlagged] = useState(false);

  useEffect(() => { setFlipped(false); setEditFront(front); setEditBack(back); setEditing(false); }, [front, back]);

  const handleDelete = async () => {
    if (!cardId) return;
    if (!confirm('Delete this flashcard permanently?')) return;
    setActionLoading(true);
    try {
      await fetch(`/api/revision?cardId=${cardId}`, { method: 'DELETE' });
      window.location.reload(); // Quick refresh to update queue
    } finally { setActionLoading(false); }
  };

  const handleSaveEdit = async () => {
    if (!cardId) return;
    setActionLoading(true);
    try {
      await fetch('/api/revision', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, front: editFront, back: editBack }),
      });
      setEditing(false);
      window.location.reload();
    } finally { setActionLoading(false); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)', width: '100%', maxWidth: 640, margin: '0 auto' }}>
      
      {/* Action Bar */}
      {cardId && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--sp-2)' }}>
          <button onClick={() => setEditing(!editing)} style={{ background: 'none', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--text-secondary)' }}>
            <Pencil size={12} /> Edit
          </button>
          <button onClick={() => setFlagged(!flagged)} style={{ background: flagged ? 'var(--warning-dim)' : 'none', border: `1px solid ${flagged ? 'var(--warning)' : 'var(--border-default)'}`, borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: flagged ? 'var(--warning)' : 'var(--text-secondary)' }}>
            <Flag size={12} /> Flag
          </button>
          <button onClick={handleDelete} disabled={actionLoading} style={{ background: 'none', border: '1px solid var(--danger-dim)', borderRadius: 'var(--radius-sm)', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--fs-xs)', color: 'var(--danger)' }}>
            <Trash2 size={12} /> Delete
          </button>
        </div>
      )}

      {/* Edit Form */}
      {editing ? (
        <Card padding="md" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Front</label>
          <textarea value={editFront} onChange={e => setEditFront(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'white', borderRadius: '4px' }} />
          <label style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>Back</label>
          <textarea value={editBack} onChange={e => setEditBack(e.target.value)} rows={3} style={{ width: '100%', padding: '8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-default)', color: 'white', borderRadius: '4px' }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <button onClick={() => setEditing(false)} style={{ padding: '6px 12px', cursor: 'pointer' }}>Cancel</button>
            <button onClick={handleSaveEdit} style={{ background: 'var(--success)', color: 'white', border: 'none', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px' }}>Save</button>
          </div>
        </Card>
      ) : (
        /* The Card */
        <Card padding="lg" onClick={() => !flipped && setFlipped(true)} style={{ minHeight: 320, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: flipped ? 'default' : 'pointer', border: flipped ? '1px solid var(--accent-purple)' : '1px solid var(--border-default)' }}>
          <div style={{ fontSize: 'var(--fs-lg)', textAlign: 'center' }}>
            {flipped ? back : front}
          </div>
          {!flipped && <div style={{ marginTop: 'var(--sp-6)', color: 'var(--text-tertiary)', fontSize: 'var(--fs-xs)' }}><RotateCcw size={12} style={{display:'inline'}}/> Tap to reveal</div>}
        </Card>
      )}

      {/* Ratings */}
      {flipped && !editing && (
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <button onClick={() => onRate('again')} style={{ flex: 1, padding: '12px', background: 'var(--danger-dim)', color: 'var(--danger)', border: 'none', borderRadius: '8px', cursor:'pointer' }}>Again</button>
          <button onClick={() => onRate('hard')} style={{ flex: 1, padding: '12px', background: 'var(--warning-dim)', color: 'var(--warning)', border: 'none', borderRadius: '8px', cursor:'pointer' }}>Hard</button>
          <button onClick={() => onRate('good')} style={{ flex: 1, padding: '12px', background: 'var(--success-dim)', color: 'var(--success)', border: 'none', borderRadius: '8px', cursor:'pointer' }}>Good</button>
          <button onClick={() => onRate('easy')} style={{ flex: 1, padding: '12px', background: 'var(--accent-cyan-dim)', color: 'var(--accent-cyan)', border: 'none', borderRadius: '8px', cursor:'pointer' }}>Easy</button>
        </div>
      )}
    </div>
  );
}
