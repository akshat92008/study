# MODULE UPGRADE: ATLAS — Knowledge Graph

## Current State: 70% → Target: 95%

---

## What Works Today
- 6-tier mastery classification with numeric weights
- Concept links (prerequisite/related/confusion) with strength propagation
- Hybrid decay (FSRS retention + Ebbinghaus fallback)
- Deep hierarchy grouping (Subject → Chapter → Topic → Concept)
- Weak cluster detection
- AI cognition state analysis
- pgvector embeddings on concepts
- Recursive micro-concept seeding (limited chapters)

---

## Upgrade 1: AI-Powered Dynamic Concept Expansion (P1)

**Problem:** Only ~6 chapters have hardcoded micro-concept expansions. Most chapters get a single generic node.

**Files to modify:**
- `lib/engines/cognition-graph.ts` — Add `expandChapterViaMind()` function
- `lib/actions/onboarding.ts` — Call expansion during seeding

**Implementation:**
```typescript
export async function expandChapterViaMind(userId: string, subject: string, chapter: string) {
  const prompt = `Break down the chapter "${chapter}" (${subject}) into 3-7 essential micro-concepts.
  For each, identify prerequisites from other chapters if any.
  
  Respond as JSON:
  {
    "concepts": [
      { "name": "Concept Name", "topic": "Parent Topic", "prerequisites": ["Other Concept Name"] }
    ]
  }`;
  
  const result = await generateJSON('flash', 'Expert curriculum designer.', prompt);
  
  // Insert concepts and auto-link prerequisites
  for (const concept of result.concepts) {
    const { data } = await supabase.from('concepts').insert({
      user_id: userId, name: concept.name, subject, chapter, topic: concept.topic,
      mastery: 'not_started', confidence: 'low',
    }).select().single();
    
    // Resolve and link prerequisites...
  }
}
```

**Estimated effort:** 6–8 hours

---

## Upgrade 2: Interactive Node-Edge Graph Visualization (P2)

**Problem:** Need a true interactive graph, not just a hierarchical list.

**Options:**
1. **D3.js force-directed graph** — Most flexible, best for large graphs
2. **React Flow** — Easier to integrate, good for smaller graphs
3. **Custom canvas/SVG** — Full control

**Files to create:**
- `components/cognition/InteractiveGraph.tsx` — D3/React Flow visualization
- Node colors based on mastery tier (cyan=automated, green=mastered, yellow=developing, red=not_started)
- Edge thickness based on link strength
- Click-to-drill-down into concept details
- Zoom/pan controls

**Estimated effort:** 12–16 hours

---

## Upgrade 3: Forgetting Heatmap Animation (P2)

**Problem:** Vision describes nodes shifting color dynamically.

**Files to modify:**
- `components/cognition/KnowledgeMap.tsx` — Add animated color transitions
- `app/globals.css` — Add mastery-tier color animations

**Implementation:**
```css
@keyframes decay-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.concept-node[data-forgetting="high"] {
  animation: decay-pulse 2s ease-in-out infinite;
  border-color: var(--danger);
}
```

**Estimated effort:** 3–4 hours

---

## Upgrade 4: Cross-Module Concept Resolution (P1)

**Problem:** When autopsy/mistakes reference a chapter name string, there's no fuzzy matching to find the concept node.

**Files to create:**
- `lib/engines/concept-resolver.ts` — Fuzzy matching + semantic search

**Implementation:**
```typescript
export async function resolveConceptByName(userId: string, subject: string, chapter: string) {
  const supabase = await createClient();
  
  // Exact match first
  let { data } = await supabase.from('concepts').select('id')
    .eq('user_id', userId).eq('subject', subject).eq('chapter', chapter).limit(1).single();
  
  if (data) return data.id;
  
  // Fuzzy match via ilike
  const { data: fuzzy } = await supabase.from('concepts').select('id')
    .eq('user_id', userId).ilike('chapter', `%${chapter}%`).limit(1).single();
  
  if (fuzzy) return fuzzy.id;
  
  // Semantic match via pgvector (most expensive, most accurate)
  const embedding = await getEmbedding(`${subject} ${chapter}`);
  const { data: semantic } = await supabase.rpc('match_concepts', {
    query_embedding: embedding, match_threshold: 0.6, match_count: 1, p_user_id: userId,
  });
  
  return semantic?.[0]?.id || null;
}
```

**Estimated effort:** 4–5 hours

---

## Total Estimated Effort: 25–33 hours
