# MODULE UPGRADE: AUTOPSY — Mock Test Intelligence Engine

## Current State: 65% → Target: 95%

---

## What Works Today
- Multimodal OCR via Gemini 2.5 Flash (text + image + PDF)
- 9-category cognitive mistake taxonomy
- Recoverable score calculation
- AI mentor quote + 3-day recovery sprint plan
- Batch question insertion (chunks of 50)
- Exam-agnostic scoring with custom override
- ShareCard component for viral sharing

---

## Upgrade 1: AUTOPSY → ATLAS Pipeline (P0 Critical)

**Problem:** When autopsy finds mistakes in a chapter, it doesn't downscale concept mastery in ATLAS.

**Files to modify:**
- `lib/engines/autopsy-engine.ts` — After processing, call concept state updater

**Implementation:**
```typescript
// After the batch question insert (line ~148):
// Sync mistakes to ATLAS
for (const q of processedQuestions.filter(q => q.status === 'Incorrect')) {
  const { data: concept } = await supabase
    .from('concepts')
    .select('id')
    .eq('user_id', userId)
    .ilike('chapter', `%${q.chapter}%`)
    .limit(1)
    .single();
  
  if (concept) {
    await updateConceptState(concept.id, false, 0);
  }
}
```

**Estimated effort:** 3–4 hours

---

## Upgrade 2: AUTOPSY → MEMORY Auto-Card Pipeline (P0 Critical)

**Problem:** Incorrect questions should auto-generate flashcards.

**Files to modify:**
- `lib/engines/autopsy-engine.ts` — Trigger card creation for each incorrect question
- `lib/engines/revision-engine.ts` — Add `createCardFromMistake()` function

**Implementation:**
```typescript
export async function createCardFromMistake(
  userId: string, conceptId: string | null,
  subject: string, chapter: string,
  question: string, correctAnswer: string, reasoning: string
) {
  const emptyCard = createEmptyCard();
  await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front: `[Mistake Recovery] ${question}`,
    back: `Correct: ${correctAnswer}\n\nWhy you got it wrong: ${reasoning}`,
    subject, chapter,
    due: emptyCard.due.toISOString(),
    stability: emptyCard.stability,
    difficulty: emptyCard.difficulty,
    elapsed_days: 0, scheduled_days: 0,
    reps: 0, lapses: 0, state: 0,
  });
}
```

**Estimated effort:** 3–4 hours

---

## Upgrade 3: Score Bridge Dashboard UI (P1 High)

**Problem:** The most visually impressive feature described in the vision has no dedicated dashboard.

**Files to create:**
- `components/autopsy/AutopsyDashboard.tsx` — Full autopsy results view
- `components/autopsy/ScoreBridge.tsx` — Animated score bridge visualization

**Key UI elements:**
1. **Score Bridge:** Animated bar/bridge showing Actual Score → Recoverable → Potential
2. **Mistake Category Breakdown:** Pie/donut chart of the 9 categories
3. **Chapter Loss Heatmap:** Which chapters cost the most marks
4. **Recovery Sprint Plan:** 3-day action cards
5. **Mentor Quote:** Large, styled mentor insight

**Estimated effort:** 8–12 hours

---

## Upgrade 4: Real PDF Upload Handler (P0 Critical)

**Problem:** The ingest route needs to handle actual file uploads (multipart/form-data → base64 → Gemini).

**Files to modify:**
- `app/api/autopsy/ingest/route.ts` — Handle file upload properly

**Implementation:**
```typescript
export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const testName = formData.get('testName') as string;
  
  const buffer = await file.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');
  
  const fileData = {
    kind: 'inline' as const,
    mimeType: file.type,
    data: base64,
  };
  
  const result = await processMockAutopsy(userId, fileData, testName, examType);
  return Response.json(result);
}
```

**Estimated effort:** 2–3 hours

---

## Upgrade 5: Historical Autopsy Trends

**Problem:** No view showing score progression across multiple autopsies.

**Files to create:**
- `components/autopsy/AutopsyTrends.tsx` — Line chart of scores over time

**Estimated effort:** 3–4 hours

---

## Total Estimated Effort: 19–27 hours
