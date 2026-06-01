'use client';

import { useState, useEffect } from 'react';
import FlashCard from './FlashCard';
import { Loader2, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';
import { submitReview } from '@/lib/actions/revision';

export default function RevisionQueue() {
  const [queue, setQueue] = useState<any[]>([]);
  const [initialCount, setInitialCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const { addToast } = useAppStore();

  useEffect(() => {
    async function loadQueue() {
      try {
        const res = await fetch('/api/revision');
        if (!res.ok) throw new Error('Failed to load queue');
        const data = await res.json();
        const dueCards = data.dueCards || [];
        setQueue(dueCards);
        setInitialCount(dueCards.length);
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
  const completedCount = Math.max(0, initialCount - queue.length);
  const progress = initialCount > 0 ? Math.round((completedCount / initialCount) * 100) : 0;
  const front = currentCard.front || `Concept: ${currentCard.subject || currentCard.chapter || currentCard.concept_id || currentCard.id}`;
  const back = currentCard.back || currentCard.answer || currentCard.explanation || 'Review the concept, then rate how well you recalled it.';
  const source = currentCard.source
    || (front.startsWith('[Mock Recovery]') ? 'mock recovery'
      : front.startsWith('[Mistake Recovery]') ? 'mistake recovery'
        : front.startsWith('[Tutor Gap]') ? 'MIND session gap'
          : currentCard.chapter || currentCard.subject || null);

  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 'var(--fs-sm)', color: 'var(--text-tertiary)', padding: '0 var(--sp-4)' }}>
        <span>Cards remaining: {queue.length}</span>
        <span style={{ color: 'var(--accent-cyan)', fontWeight: 'var(--fw-medium)' }}>{progress}% Complete</span>
      </div>
      {source && (
        <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', padding: '0 var(--sp-4)' }}>
          Source: {source}
        </div>
      )}
      
      <FlashCard 
        front={front} 
        back={back} 
        cardIndex={0}
        totalCards={queue.length}
        onRate={handleRate} 
      />
    </div>
  );
}
