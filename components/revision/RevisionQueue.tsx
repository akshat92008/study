'use client';

import { useState, useEffect } from 'react';
import FlashCard from './FlashCard';
import { Loader2, CheckCircle } from 'lucide-react';
import { useAppStore } from '@/stores/appStore';

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
    
    // Optimistic UI update
    setQueue(q => q.slice(1));
    
    // In a real app, you would send this rating to the backend API here:
    // await fetch('/api/revision/rate', { method: 'POST', body: JSON.stringify({ cardId: currentCard.id, rating }) });
  };

  if (loading) {
    return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-cyan-500" size={32} /></div>;
  }

  if (queue.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-zinc-400 gap-4">
        <CheckCircle size={48} className="text-green-500/50" />
        <p className="text-lg font-medium text-zinc-300">You're all caught up!</p>
        <p className="text-sm">No cards due for revision right now.</p>
      </div>
    );
  }

  const currentCard = queue[0];

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-between items-center text-sm text-zinc-400 px-4">
        <span>Cards remaining: {queue.length}</span>
        <span className="text-cyan-400 font-medium">{Math.round(((1 - queue.length) / 1) * 100) || 0}% Complete</span>
      </div>
      
      {/* For demo purposes, we fallback to a stub string if the card structure is complex */}
      <FlashCard 
        front={currentCard.front || 'Concept: ' + (currentCard.concept_id || currentCard.id)} 
        back={currentCard.back || 'Detailed recall information...'} 
        onRate={handleRate} 
      />
    </div>
  );
}
