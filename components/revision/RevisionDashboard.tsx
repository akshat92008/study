'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { submitReview } from '@/lib/actions/revision';
import { RefreshCw, ChevronRight, RotateCcw, Check, Zap } from 'lucide-react';
import CardSchedule from './CardSchedule';
import { logStudentEvent } from '@/lib/utils/events';

export default function RevisionDashboard({ data }: { data: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const [cardStartTime, setCardStartTime] = useState(0);

  const { due = [], stats = {} } = data || {};
  const currentCard = due[currentIndex];

  useEffect(() => {
    setCardStartTime(Date.now());
  }, [currentIndex]);

  async function handleRating(rating: 1 | 2 | 3 | 4) {
    if (!currentCard) return;
    setReviewing(true);
    const responseTimeMs = Date.now() - cardStartTime;

    const ratingLabels = { 1: 'Again', 2: 'Hard', 3: 'Good', 4: 'Easy' };
    
    // Log the review event to the event bus
    logStudentEvent('flashcard_review', {
      cardId: currentCard.id,
      subject: currentCard.subject,
      chapter: currentCard.chapter,
      front: currentCard.front.substring(0, 100), // keep it compact for the context
      rating: ratingLabels[rating],
      responseTimeMs
    });

    await submitReview(currentCard.id, rating, responseTimeMs);
    setShowAnswer(false);
    setReviewing(false);
    if (currentIndex < due.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      window.location.reload();
    }
  }

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <RefreshCw size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-cyan)' }} />
          Revision Engine
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
          FSRS-5 powered spaced repetition • Optimized for 90% retention
        </p>
      </div>

      {/* Stats */}
      <div className="grid-4 stagger">
        <Card><div className="label">Due Now</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--warning)' }}>{stats.due || 0}</div>
        </Card>
        <Card><div className="label">Total Cards</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)' }}>{stats.total || 0}</div>
        </Card>
        <Card><div className="label">Learning</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-purple)' }}>{stats.learning || 0}</div>
        </Card>
        <Card><div className="label">Mature</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)' }}>{stats.mature || 0}</div>
        </Card>
      </div>

      {/* Review Card */}
      {currentCard ? (
        <Card padding="lg" variant="glow" style={{ minHeight: 300, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--sp-4)' }}>
            <Badge color="blue">{currentCard.subject}</Badge>
            <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
              {currentIndex + 1} / {due.length}
            </span>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ textAlign: 'center', maxWidth: 600 }}>
              <p style={{ fontSize: 'var(--fs-lg)', lineHeight: 'var(--lh-relaxed)' }}>
                {showAnswer ? currentCard.back : currentCard.front}
              </p>
            </div>
          </div>

          {!showAnswer ? (
            <div style={{ textAlign: 'center' }}>
              <Button onClick={() => setShowAnswer(true)} size="lg">
                Show Answer <ChevronRight size={18} />
              </Button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--sp-3)' }}>
              <Button variant="danger" onClick={() => handleRating(1)} isLoading={reviewing}>
                <RotateCcw size={16} /> Again
              </Button>
              <Button variant="secondary" onClick={() => handleRating(2)} isLoading={reviewing}>
                Hard
              </Button>
              <Button onClick={() => handleRating(3)} isLoading={reviewing}>
                <Check size={16} /> Good
              </Button>
              <Button variant="ghost" onClick={() => handleRating(4)} isLoading={reviewing} style={{ color: 'var(--success)' }}>
                <Zap size={16} /> Easy
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <Card style={{ textAlign: 'center', padding: 'var(--sp-12)' }}>
          <RefreshCw size={48} style={{ color: 'var(--success)', margin: '0 auto var(--sp-4)' }} />
          <p style={{ fontSize: 'var(--fs-md)', color: 'var(--success)', fontWeight: 'var(--fw-semibold)' }}>
            All caught up!
          </p>
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-1)', marginBottom: 'var(--sp-4)' }}>
            {stats.total > 0 ? 'No cards due for review right now.' : 'Generate cards from the Cognition Graph to start reviewing.'}
          </p>
          {stats.total === 0 && (
            <a href="/cognition" style={{
              display: 'inline-block', padding: 'var(--sp-2) var(--sp-4)',
              background: 'var(--accent-cyan)', color: 'var(--bg-root)',
              borderRadius: 'var(--radius-md)', fontSize: 'var(--fs-sm)', 
              fontWeight: 'var(--fw-semibold)', textDecoration: 'none'
            }}>Go to Cognition Graph</a>
          )}
        </Card>
      )}

      {/* Per-Card Retention & Schedule Visualization */}
      {(data?.allCards || []).length > 0 && (
        <CardSchedule cards={data.allCards} />
      )}
    </div>
  );
}
