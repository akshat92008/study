'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { Sparkles, Check, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function PendingCards({ goalId }: { goalId?: string | null }) {
  const [cards, setCards] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    try {
      const qs = goalId ? `?goalId=${goalId}&status=pending` : '?status=pending';
      const res = await fetch(`/api/revision/pending${qs}`);
      if (res.ok) {
        const data = await res.json();
        setCards(data.cards || []);
      }
    } catch (e) {
      console.error('Failed to fetch pending cards', e);
    } finally {
      setLoading(false);
    }
  }, [goalId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const handleDecision = async (id: string, decision: 'approved' | 'rejected') => {
    setProcessingId(id);
    try {
      const res = await fetch(`/api/revision/pending/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: decision }),
      });
      if (res.ok) {
        setCards(prev => prev.filter(c => c.id !== id));
        window.dispatchEvent(new Event('refresh-goal-context'));
      }
    } catch (e) {
      console.error('Decision failed', e);
    } finally {
      setProcessingId(null);
    }
  };

  if (loading && cards.length === 0) return null;
  if (!loading && cards.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent-purple)' }}>
        <Sparkles size={18} />
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: 0 }}>Proposed by Amaura</h3>
        <Badge color="purple">{cards.length}</Badge>
      </div>

      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', 
        gap: 'var(--sp-4)' 
      }}>
        <AnimatePresence>
          {cards.map((card) => (
            <motion.div
              key={card.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <Card variant="glow" style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', background: 'var(--bg-secondary)', border: '1px dashed var(--accent-purple-dim)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Badge color="blue">{card.subject || 'General'}</Badge>
                  <span style={{ fontSize: '9px', color: 'var(--text-tertiary)', textTransform: 'uppercase', fontWeight: 'bold' }}>
                    Origin: {card.origin}
                  </span>
                </div>
                
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 2 }}>QUESTION</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>{card.front}</div>
                  
                  <div style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginBottom: 2 }}>ANSWER</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{card.back}</div>
                </div>

                <div style={{ display: 'flex', gap: 8, marginTop: 'var(--sp-2)' }}>
                  <Button 
                    size="sm" 
                    onClick={() => handleDecision(card.id, 'approved')}
                    disabled={processingId === card.id}
                    style={{ flex: 1, background: 'var(--success)', color: 'white' }}
                  >
                    {processingId === card.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                  </Button>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={() => handleDecision(card.id, 'rejected')}
                    disabled={processingId === card.id}
                    style={{ flex: 1 }}
                  >
                    <X size={14} /> Skip
                  </Button>
                </div>
              </Card>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
