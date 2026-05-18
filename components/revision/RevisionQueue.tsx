'use client';

import { useState, useEffect } from 'react';
import FlashCard from './FlashCard';
import { Loader2, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { submitReview } from '@/lib/actions/revision';

export default function RevisionQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useAppStore();

  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await fetch('/api/revision');
        if (!res.ok) throw new Error('Failed to load queue');
        const data = await res.json();
        setQueue(data.dueCards || []);
      } catch (err: any) {
        addToast(err.message, 'error');
      } finally {
        setLoading(false);
      }
    }
    loadQueue();
  }, [addToast]);

  const handleRate = async (rating: string) => {
    const currentCard = queue[0];
    if (!currentCard) return;
    const ratingMap: Record<string, 1 | 2 | 3 | 4> = {
      again: 1,
      hard: 2,
      good: 3,
      easy: 4,
    };
    
    // Optimistic UI update
    setQueue(q => q.slice(1));

    try {
      await submitReview(currentCard.id, ratingMap[rating] || 3);
    } catch (err: any) {
      setQueue(q => [currentCard, ...q]);
      addToast(err.message || 'Failed to save review', 'error');
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
        <Loader2 color="var(--accent-cyan)" size={32} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (queue.length === 0) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--sp-12)', color: 'var(--text-tertiary)', gap: 'var(--sp-4)'
      }}>
        <CheckCircle size={48} color="var(--success-dim)" />
        <p style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>You're all caught up!</p>
        <p style={{ fontSize: 'var(--fs-sm)' }}>No cards due for revision right now.</p>
      </div>
    );
  }

  const currentCard = queue[0];

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: '0 var(--sp-4)' }}>
        <span>Cards remaining: {queue.length}</span>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 'var(--fw-medium)' }}>{Math.round(((1 - queue.length) / 1) * 100) || 0}% Complete</span>
      </div>
      
      {/* For demo purposes, we fallback to a stub string if the card structure is complex */}
      <FlashCard 
        front={currentCard.front || 'Concept: ' + (currentCard.concept_id || currentCard.id)} 
        back={currentCard.back || 'Detailed recall information...'} 
        cardIndex={0}
        totalCards={queue.length}
        onRate={handleRate} 
      />
    </div>
  );
}
