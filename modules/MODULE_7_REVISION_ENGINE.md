# MODULE 7: FSRS Revision Engine

## PROMPT FOR AI BUILDER

```
Build the Adaptive Revision Engine using ts-fsrs (FSRS-5 algorithm).
This powers spaced repetition with forgetting curve prediction.
Create: lib/engines/revision-engine.ts, lib/actions/revision.ts, the page, and components.
Import { createEmptyCard, fsrs, Rating, State } from 'ts-fsrs'.
```

---

## STEP 1: Revision Engine — `lib/engines/revision-engine.ts`

```typescript
import { createEmptyCard, fsrs, Rating, type Card as FSRSCard } from 'ts-fsrs';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';

const scheduler = fsrs({
  request_retention: 0.9, // Target 90% retention
  maximum_interval: 365,
});

// Convert DB row to FSRS Card
function toFSRSCard(row: any): FSRSCard {
  return {
    due: new Date(row.due),
    stability: row.stability,
    difficulty: row.difficulty,
    elapsed_days: row.elapsed_days,
    scheduled_days: row.scheduled_days,
    reps: row.reps,
    lapses: row.lapses,
    state: row.state,
    last_review: row.last_review ? new Date(row.last_review) : undefined,
  } as FSRSCard;
}

// Get cards due for review
export async function getDueCards(userId: string, limit: number = 20) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId)
    .lte('due', now)
    .order('due', { ascending: true })
    .limit(limit);

  return data || [];
}

// Get all cards with stats
export async function getRevisionStats(userId: string) {
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { data: allCards } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('user_id', userId);

  const cards = allCards || [];
  const due = cards.filter(c => new Date(c.due) <= new Date());
  const newCards = cards.filter(c => c.state === 0);
  const learning = cards.filter(c => c.state === 1 || c.state === 3);
  const mature = cards.filter(c => c.state === 2 && c.stability > 21);

  return {
    total: cards.length,
    due: due.length,
    new: newCards.length,
    learning: learning.length,
    mature: mature.length,
    averageRetention: cards.length > 0
      ? Math.round(cards.reduce((sum, c) => sum + (1 - (c.forgetting_probability || 0)), 0) / cards.length * 100)
      : 0,
  };
}

// Review a card — apply FSRS algorithm
export async function reviewCard(cardId: string, rating: 1 | 2 | 3 | 4) {
  const supabase = await createClient();

  const { data: row } = await supabase
    .from('revision_cards')
    .select('*')
    .eq('id', cardId)
    .single();

  if (!row) throw new Error('Card not found');

  const fsrsCard = toFSRSCard(row);
  const now = new Date();
  const ratingMap: Record<number, Rating> = {
    1: Rating.Again, 2: Rating.Hard, 3: Rating.Good, 4: Rating.Easy,
  };

  const result = scheduler.next(fsrsCard, now, ratingMap[rating]);
  const updated = result.card;

  // Update card in DB
  await supabase.from('revision_cards').update({
    due: updated.due.toISOString(),
    stability: updated.stability,
    difficulty: updated.difficulty,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    reps: updated.reps,
    lapses: updated.lapses,
    state: updated.state,
    last_review: now.toISOString(),
  }).eq('id', cardId);

  // Log the review
  await supabase.from('review_logs').insert({
    user_id: row.user_id,
    card_id: cardId,
    rating,
    elapsed_days: updated.elapsed_days,
    scheduled_days: updated.scheduled_days,
    state: updated.state,
  });

  return { nextDue: updated.due, scheduledDays: updated.scheduled_days };
}

// Generate revision cards from a concept using AI
export async function generateCardsForConcept(userId: string, conceptId: string, subject: string, chapter: string) {
  const prompt = `Generate 5 flashcard-style revision questions for NEET ${subject}, chapter: "${chapter}".

Each card should test a key concept that frequently appears in NEET exams.
Mix question types: definition, application, numerical, comparison.

Respond as JSON array:
[
  { "front": "question text (can include LaTeX with $...$)", "back": "answer with explanation" }
]`;

  const cards = await generateJSON<Array<{ front: string; back: string }>>('flash',
    'You are an expert NEET exam content creator.', prompt);

  const supabase = await createClient();
  const emptyCard = createEmptyCard();

  const rows = (cards || []).map(c => ({
    user_id: userId,
    concept_id: conceptId,
    front: c.front,
    back: c.back,
    subject,
    chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: emptyCard.elapsed_days,
    scheduled_days: emptyCard.scheduled_days,
    reps: emptyCard.reps,
    lapses: emptyCard.lapses,
    state: emptyCard.state,
  }));

  const { data } = await supabase.from('revision_cards').insert(rows).select();
  return data;
}
```

---

## STEP 2: Server Actions — `lib/actions/revision.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { getDueCards, getRevisionStats, reviewCard, generateCardsForConcept } from '@/lib/engines/revision-engine';

export async function getRevisionData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [due, stats] = await Promise.all([
    getDueCards(user.id),
    getRevisionStats(user.id),
  ]);

  return { due, stats };
}

export async function submitReview(cardId: string, rating: 1 | 2 | 3 | 4) {
  return reviewCard(cardId, rating);
}

export async function generateCards(conceptId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return generateCardsForConcept(user.id, conceptId, subject, chapter);
}
```

---

## STEP 3: Revision Page — `app/(dashboard)/revision/page.tsx`

```tsx
import { getRevisionData } from '@/lib/actions/revision';
import RevisionDashboard from '@/components/revision/RevisionDashboard';

export default async function RevisionPage() {
  const data = await getRevisionData();
  return <RevisionDashboard data={data} />;
}
```

---

## STEP 4: Revision Dashboard — `components/revision/RevisionDashboard.tsx`

```tsx
'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { submitReview } from '@/lib/actions/revision';
import { RefreshCw, ChevronRight, RotateCcw, Check, Zap } from 'lucide-react';

export default function RevisionDashboard({ data }: { data: any }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  const { due = [], stats = {} } = data || {};
  const currentCard = due[currentIndex];

  async function handleRating(rating: 1 | 2 | 3 | 4) {
    if (!currentCard) return;
    setReviewing(true);
    await submitReview(currentCard.id, rating);
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
          <p style={{ color: 'var(--text-tertiary)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-1)' }}>
            {stats.total > 0 ? 'No cards due for review right now.' : 'Generate cards from the Cognition Graph to start reviewing.'}
          </p>
        </Card>
      )}
    </div>
  );
}
```

---

## VERIFICATION

```bash
npm run dev
# 1. Navigate to /dashboard/revision
# 2. Stats cards should show (all zeros initially)
# 3. "All caught up" state should show when no cards due
# 4. To test: generate cards via Cognition Graph, then review here
```

**→ NEXT: MODULE 8 (AI Mentor)**
