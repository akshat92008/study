# MODULE UPGRADE: MEMORY — FSRS-5 Revision Engine

## Current State: 80% → Target: 95%

---

## What Works Today
- Full FSRS-5 implementation via ts-fsrs with tuned weights
- 90% target retention calibration
- getDueCards() with overdue + difficulty priority
- reviewCard() with full lifecycle (FSRS math → DB update → review log → concept sync → performance snapshot)
- RAG-driven auto card generation from uploaded materials
- FlashCard, RevisionDashboard, RevisionQueue, SessionComplete UI components
- Card state distribution stats

---

## Upgrade 1: Auto-Card from Uploaded Material at Onboarding (P1)

**Problem:** Vision says cards are auto-generated from uploaded material. The function exists but isn't triggered during onboarding.

**Files to modify:**
- `lib/actions/onboarding.ts` — After seeding concepts, trigger card generation
- `components/onboarding/DynamicCurriculumGenerator.tsx` — Add material upload step

**Implementation:**
```typescript
// In completeOnboarding(), after seedKnowledgeGraph:
if (uploadedMaterialIds.length > 0) {
  const { data: concepts } = await supabase.from('concepts')
    .select('id, subject, chapter').eq('user_id', userId).limit(20);
  
  // Generate cards for the first 20 concepts asynchronously
  for (const concept of concepts || []) {
    await generateCardsForConcept(userId, concept.id, concept.subject, concept.chapter);
  }
}
```

**Estimated effort:** 3–4 hours

---

## Upgrade 2: Mistake-to-Card Pipeline (P0 Critical)

**Problem:** Autopsy mistakes should auto-create cards. This is the most critical missing pipeline.

**Files to create:**
- `lib/engines/mistake-to-card.ts` — Pipeline function

**Implementation:**
```typescript
import { createEmptyCard } from 'ts-fsrs';
import { createClient } from '@/lib/supabase/server';

export async function createCardsFromAutopsyMistakes(userId: string, autopsyId: string) {
  const supabase = await createClient();
  
  const { data: questions } = await supabase.from('autopsy_questions')
    .select('*').eq('autopsy_id', autopsyId).eq('status', 'Incorrect');
  
  if (!questions || questions.length === 0) return 0;
  
  const emptyCard = createEmptyCard();
  const cards = questions.map(q => ({
    user_id: userId,
    front: `[Mock Recovery] Q${q.question_number}: ${q.subject} > ${q.chapter}\nMistake type: ${q.mistake_category}`,
    back: `Correct answer: ${q.correct_answer}\nFix: ${q.suggested_fix}`,
    subject: q.subject,
    chapter: q.chapter || '',
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty + 0.5, // Boost difficulty for mistake cards
    elapsed_days: 0, scheduled_days: 0,
    reps: 0, lapses: 0, state: 0,
  }));
  
  await supabase.from('revision_cards').insert(cards);
  return cards.length;
}
```

**Estimated effort:** 2–3 hours

---

## Upgrade 3: Card Quality Controls (P2)

**Problem:** No way for students to flag, edit, or delete AI-generated cards.

**Files to modify:**
- `components/revision/FlashCard.tsx` — Add edit/flag/delete actions
- `app/api/revision/route.ts` — Add PATCH/DELETE endpoints

**Estimated effort:** 3–4 hours

---

## Upgrade 4: Per-Card Retention Visualization (P3)

**Problem:** No UI showing individual card stability curves or next-review schedule.

**Files to create:**
- `components/revision/CardSchedule.tsx` — Show upcoming reviews with stability info

**Estimated effort:** 4–5 hours

---

## Total Estimated Effort: 12–16 hours
