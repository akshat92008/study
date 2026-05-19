# MODULE UPGRADE: MIND — Socratic AI Tutor

## Current State: 70% → Target: 95%

---

## What Works Today
- Socratic Loop system prompt (5-step protocol)
- Adaptive difficulty based on mastery + emotional state
- LaTeX rendering via KaTeX
- RAG context injection from student's uploaded materials
- Student context engine (exam info, weak areas, mistake history)
- Streaming chat API

---

## Upgrade 1: Longitudinal Conversation Memory

**Problem:** Tutor sessions are isolated. MIND can't say "Remember when you asked about this 6 weeks ago?"

**Files to modify:**
- `lib/ai/prompts/tutor.ts` — Add historical session context block
- `app/api/ai/tutor/route.ts` — Fetch last 5 sessions on same subject/chapter before responding
- `lib/db/schema.ts` — Add `summary` field to `tutorSessions` table

**Implementation:**
```typescript
// In the tutor API route, before building the prompt:
const { data: pastSessions } = await supabase
  .from('tutor_sessions')
  .select('messages, concept_id, started_at')
  .eq('user_id', userId)
  .order('started_at', { ascending: false })
  .limit(5);

// Inject into context:
const historyBlock = pastSessions?.map(s => 
  `[${s.started_at}] Previous session summary: ${summarizeSession(s.messages)}`
).join('\n');
```

**Estimated effort:** 4–6 hours

---

## Upgrade 2: MIND → ATLAS Write-Back

**Problem:** Tutor reads from ATLAS but never updates mastery after teaching a concept.

**Files to modify:**
- `app/api/ai/tutor/route.ts` — After each successful Socratic exchange, call `updateConceptState`
- `lib/engines/cognition-graph.ts` — Expose a lighter-weight mastery bump function

**Implementation:**
```typescript
// After the AI confirms understanding (detect via response analysis):
import { updateConceptState } from '@/lib/engines/cognition-graph';

// In the tutor response handler:
if (conceptId && studentDemonstratedUnderstanding) {
  await updateConceptState(conceptId, true, 0);
}
```

**Estimated effort:** 2–3 hours

---

## Upgrade 3: MIND → MEMORY Card Creation

**Problem:** When MIND identifies a gap, it should auto-create a flashcard for that concept.

**Files to modify:**
- `app/api/ai/tutor/route.ts` — Detect confusion/gap and trigger card creation
- `lib/engines/revision-engine.ts` — Add `createSingleCard()` function

**Implementation:**
```typescript
// After detecting a knowledge gap in the tutor conversation:
async function createSingleCard(userId: string, conceptId: string, front: string, back: string) {
  const emptyCard = createEmptyCard();
  await supabase.from('revision_cards').insert({
    user_id: userId,
    concept_id: conceptId,
    front, back,
    ...emptyCard,
    due: emptyCard.due.toISOString(),
  });
}
```

**Estimated effort:** 3–4 hours

---

## Upgrade 4: Prerequisite Chain Traversal

**Problem:** MIND doesn't trace prerequisite dependencies to find root gaps.

**Files to modify:**
- `lib/ai/prompts/tutor.ts` — Add prerequisite context to the prompt
- `lib/engines/cognition-graph.ts` — Add `getPrerequisiteChain()` function

**Implementation:**
```typescript
export async function getPrerequisiteChain(conceptId: string): Promise<any[]> {
  const supabase = await createClient();
  const { data: links } = await supabase
    .from('concept_links')
    .select('source_concept_id, concepts!source_concept_id(name, mastery)')
    .eq('target_concept_id', conceptId)
    .eq('link_type', 'prerequisite');
  
  return links?.filter(l => ['not_started', 'exposed'].includes(l.concepts?.mastery)) || [];
}
```

**Estimated effort:** 3–4 hours

---

## Total Estimated Effort: 12–17 hours
