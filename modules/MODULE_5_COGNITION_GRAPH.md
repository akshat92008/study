# MODULE 5: Cognition Graph Engine

## PROMPT FOR AI BUILDER

```
You are building the Student Cognition Graph for Cognition OS.
This is the HEART of the platform — it models knowledge state, mastery, and concept relationships.
Build both the engine (lib/engines/cognition-graph.ts) and the UI page (app/(dashboard)/cognition/page.tsx).
Use Supabase for data, Gemini for AI analysis. Use CSS variables for styling. NO Tailwind.
Import types from @/lib/utils/types. Import Supabase client from @/lib/supabase/server.
```

---

## STEP 1: Cognition Graph Engine — `lib/engines/cognition-graph.ts`

```typescript
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/provider-client';

// Get all concepts for a user, organized by subject
export async function getCognitionGraph(userId: string) {
  const supabase = await createClient();

  const { data: concepts } = await supabase
    .from('concepts')
    .select('*')
    .eq('user_id', userId)
    .order('subject', { ascending: true });

  const { data: links } = await supabase
    .from('concept_links')
    .select('*')
    .eq('user_id', userId);

  // Group concepts by subject and chapter
  const grouped: Record<string, Record<string, typeof concepts>> = {};
  (concepts || []).forEach((c: any) => {
    if (!grouped[c.subject]) grouped[c.subject] = {};
    if (!grouped[c.subject][c.chapter]) grouped[c.subject][c.chapter] = [];
    grouped[c.subject][c.chapter].push(c);
  });

  // Calculate mastery stats
  const stats = {
    total: concepts?.length || 0,
    mastered: concepts?.filter((c: any) => c.mastery === 'mastered' || c.mastery === 'automated').length || 0,
    proficient: concepts?.filter((c: any) => c.mastery === 'proficient').length || 0,
    developing: concepts?.filter((c: any) => c.mastery === 'developing').length || 0,
    weak: concepts?.filter((c: any) => c.mastery === 'exposed' || c.mastery === 'not_started').length || 0,
    overallMastery: 0,
  };
  if (stats.total > 0) {
    const masteryValues: Record<string, number> = {
      not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
    };
    const sum = (concepts || []).reduce((acc: number, c: any) => acc + (masteryValues[c.mastery] || 0), 0);
    stats.overallMastery = Math.round(sum / stats.total);
  }

  return { concepts: concepts || [], links: links || [], grouped, stats };
}

// Initialize concepts for a subject (bulk seed from NEET chapters)
export async function seedConceptsForSubject(userId: string, subject: string, chapters: string[]) {
  const supabase = await createClient();

  const conceptRows = chapters.map((chapter) => ({
    user_id: userId,
    name: chapter,
    subject,
    chapter,
    topic: '',
    mastery: 'not_started' as const,
    confidence: 'low' as const,
  }));

  const { data, error } = await supabase.from('concepts').insert(conceptRows).select();
  if (error) throw error;
  return data;
}

// Update concept mastery after a quiz/review
export async function updateConceptMastery(
  conceptId: string,
  correct: boolean,
  timeSpent: number
) {
  const supabase = await createClient();

  const { data: concept } = await supabase
    .from('concepts')
    .select('*')
    .eq('id', conceptId)
    .single();

  if (!concept) return;

  const newReviewed = (concept.times_reviewed || 0) + 1;
  const newCorrect = (concept.times_correct || 0) + (correct ? 1 : 0);
  const newIncorrect = (concept.times_incorrect || 0) + (correct ? 0 : 1);
  const accuracy = newCorrect / newReviewed;

  // Calculate new mastery level
  let newMastery = concept.mastery;
  if (accuracy >= 0.95 && newReviewed >= 5) newMastery = 'automated';
  else if (accuracy >= 0.85 && newReviewed >= 4) newMastery = 'mastered';
  else if (accuracy >= 0.7 && newReviewed >= 3) newMastery = 'proficient';
  else if (accuracy >= 0.4 && newReviewed >= 2) newMastery = 'developing';
  else if (newReviewed >= 1) newMastery = 'exposed';

  // Calculate forgetting probability (simplified Ebbinghaus)
  const daysSinceReview = concept.last_reviewed_at
    ? (Date.now() - new Date(concept.last_reviewed_at).getTime()) / (1000 * 60 * 60 * 24)
    : 999;
  const retentionStrength = Math.min(1, accuracy * (newReviewed / 10));
  const forgettingProbability = Math.max(0, 1 - retentionStrength * Math.exp(-0.1 * daysSinceReview));

  await supabase.from('concepts').update({
    times_reviewed: newReviewed,
    times_correct: newCorrect,
    times_incorrect: newIncorrect,
    mastery: newMastery,
    confidence: accuracy >= 0.8 ? 'high' : accuracy >= 0.5 ? 'medium' : 'low',
    last_reviewed_at: new Date().toISOString(),
    retention_strength: retentionStrength,
    forgetting_probability: forgettingProbability,
    updated_at: new Date().toISOString(),
  }).eq('id', conceptId);
}

// AI analysis of cognition state
export async function analyzeCognitionState(userId: string) {
  const { concepts, stats } = await getCognitionGraph(userId);
  if (concepts.length === 0) return null;

  const weakConcepts = concepts
    .filter((c: any) => c.mastery === 'not_started' || c.mastery === 'exposed')
    .map((c: any) => `${c.subject}: ${c.chapter}`)
    .slice(0, 10);

  const prompt = `Analyze this student's knowledge state and provide strategic insights:

Overall Mastery: ${stats.overallMastery}%
Total Concepts: ${stats.total}
Mastered: ${stats.mastered}
Developing: ${stats.developing}
Weak/Not Started: ${stats.weak}

Weak areas: ${weakConcepts.join(', ')}

Respond as JSON:
{
  "summary": "2-3 sentence overall assessment",
  "topPriority": "single most important thing to focus on",
  "strengths": ["list of 2-3 strengths"],
  "criticalGaps": ["list of 2-3 critical gaps"],
  "recommendation": "specific actionable advice for today"
}`;

  return generateJSON('flash', 'You are an expert NEET exam strategist.', prompt);
}
```

---

## STEP 2: Server Actions — `lib/actions/cognition.ts`

```typescript
'use server';

import { createClient } from '@/lib/supabase/server';
import { getCognitionGraph, seedConceptsForSubject, analyzeCognitionState } from '@/lib/engines/cognition-graph';
import { NEET_CHAPTERS } from '@/lib/utils/constants';

export async function getCognitionData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return getCognitionGraph(user.id);
}

export async function initializeConcepts() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Check if concepts already seeded
  const { count } = await supabase
    .from('concepts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  if (count && count > 0) return { status: 'already_seeded' };

  // Seed all NEET chapters
  for (const [subject, chapters] of Object.entries(NEET_CHAPTERS)) {
    await seedConceptsForSubject(user.id, subject, chapters);
  }
  return { status: 'seeded' };
}

export async function getAIAnalysis() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return analyzeCognitionState(user.id);
}
```

---

## STEP 3: Cognition Page — `app/(dashboard)/cognition/page.tsx`

```tsx
import { getCognitionData, initializeConcepts } from '@/lib/actions/cognition';
import CognitionDashboard from '@/components/cognition/CognitionDashboard';

export default async function CognitionPage() {
  // Auto-seed concepts if needed
  await initializeConcepts();
  const data = await getCognitionData();

  return <CognitionDashboard data={data} />;
}
```

---

## STEP 4: Cognition Dashboard Component — `components/cognition/CognitionDashboard.tsx`

```tsx
'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Progress from '@/components/ui/Progress';
import { Brain, TrendingUp, AlertTriangle, Zap } from 'lucide-react';

interface Props {
  data: any; // CognitionGraph data from server
}

const masteryColor: Record<string, 'green' | 'blue' | 'yellow' | 'red' | 'gray'> = {
  automated: 'green', mastered: 'green', proficient: 'blue',
  developing: 'yellow', exposed: 'red', not_started: 'gray',
};

export default function CognitionDashboard({ data }: Props) {
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  if (!data) return <p style={{ color: 'var(--text-tertiary)' }}>Loading cognition graph...</p>;

  const { grouped, stats, concepts } = data;
  const subjects = Object.keys(grouped);

  const filteredGrouped = selectedSubject === 'all'
    ? grouped
    : { [selectedSubject]: grouped[selectedSubject] };

  return (
    <div className="animate-fade" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-bold)', letterSpacing: 'var(--ls-tight)' }}>
          <Brain size={28} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 'var(--sp-2)', color: 'var(--accent-purple)' }} />
          Cognition Graph
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginTop: 'var(--sp-1)' }}>
          Your knowledge state across {stats.total} concepts
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid-4 stagger">
        <Card id="stat-mastery" variant="glow">
          <div className="label">Overall Mastery</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--accent-blue)', marginTop: 'var(--sp-1)' }}>
            {stats.overallMastery}%
          </div>
          <Progress value={stats.overallMastery} color="blue" size="sm" />
        </Card>
        <Card id="stat-mastered">
          <div className="label">Mastered</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--success)', marginTop: 'var(--sp-1)' }}>
            {stats.mastered}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>of {stats.total} concepts</div>
        </Card>
        <Card id="stat-developing">
          <div className="label">Developing</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--warning)', marginTop: 'var(--sp-1)' }}>
            {stats.developing}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>need more practice</div>
        </Card>
        <Card id="stat-weak">
          <div className="label">Weak / Not Started</div>
          <div style={{ fontSize: 'var(--fs-2xl)', fontWeight: 'var(--fw-black)', fontFamily: 'var(--font-mono)', color: 'var(--danger)', marginTop: 'var(--sp-1)' }}>
            {stats.weak}
          </div>
          <div style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)' }}>critical gaps</div>
        </Card>
      </div>

      {/* Subject Filter */}
      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
        <button onClick={() => setSelectedSubject('all')} style={{
          padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-full)',
          background: selectedSubject === 'all' ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
          color: selectedSubject === 'all' ? 'white' : 'var(--text-secondary)',
          border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)',
        }}>All</button>
        {subjects.map((sub) => (
          <button key={sub} onClick={() => setSelectedSubject(sub)} style={{
            padding: 'var(--sp-2) var(--sp-4)', borderRadius: 'var(--radius-full)',
            background: selectedSubject === sub ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
            color: selectedSubject === sub ? 'white' : 'var(--text-secondary)',
            border: 'none', cursor: 'pointer', fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)',
          }}>{sub}</button>
        ))}
      </div>

      {/* Concept Grid by Chapter */}
      {Object.entries(filteredGrouped).map(([subject, chapters]: [string, any]) => (
        <div key={subject}>
          <h2 style={{ fontSize: 'var(--fs-lg)', fontWeight: 'var(--fw-semibold)', marginBottom: 'var(--sp-4)', color: 'var(--text-primary)' }}>
            {subject}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)' }}>
            {Object.entries(chapters).map(([chapter, chapterConcepts]: [string, any]) => {
              const c = chapterConcepts[0]; // Each chapter = 1 concept in initial seed
              if (!c) return null;
              const masteryPercent: Record<string, number> = {
                not_started: 0, exposed: 15, developing: 40, proficient: 70, mastered: 90, automated: 98,
              };
              return (
                <Card key={chapter} padding="sm" style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--sp-4)',
                  cursor: 'pointer', transition: 'all var(--duration-fast)',
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 'var(--fs-sm)', fontWeight: 'var(--fw-medium)' }}>{chapter}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)', marginTop: 'var(--sp-1)' }}>
                      <Badge color={masteryColor[c.mastery] || 'gray'}>{c.mastery.replace('_', ' ')}</Badge>
                      <span style={{ fontSize: 'var(--fs-xs)', color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>
                        {c.times_reviewed}x reviewed
                      </span>
                    </div>
                  </div>
                  <div style={{ width: 120 }}>
                    <Progress value={masteryPercent[c.mastery] || 0} color={masteryColor[c.mastery] === 'green' ? 'green' : masteryColor[c.mastery] === 'red' ? 'red' : 'blue'} size="sm" showLabel />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

## VERIFICATION

```bash
npm run dev
# 1. Navigate to /dashboard/cognition
# 2. Should auto-seed ~97 NEET concepts across 3 subjects
# 3. Should see: stat cards, subject filter buttons, chapter list with mastery badges
# 4. Filter buttons should toggle between subjects
```

**→ NEXT: MODULE 6 (Mistake Intelligence Engine)**
