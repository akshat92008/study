# Cognition OS — Production Readiness Audit

**Date:** 2026-05-19  
**Audited Against:** PRODUCT_VISION.md (Full Cognition OS Specification)

---

## Executive Summary

| Area | Status | Readiness |
|------|--------|-----------|
| **Infrastructure & Auth** | ✅ Functional | ~85% |
| **I. MIND — Socratic AI Tutor** | ✅ Functional | ~70% |
| **II. COMMAND — Daily Mission Engine** | ✅ Functional | ~75% |
| **III. AUTOPSY — Mock Test Engine** | ✅ Functional | ~65% |
| **IV. ATLAS — Knowledge Graph** | ✅ Functional | ~70% |
| **V. MEMORY — FSRS-5 Revision** | ✅ Functional | ~80% |
| **VI. PULSE — Mental State Engine** | ⚠️ Partial | ~50% |
| **Cross-Module Integration** | ⚠️ Partial | ~55% |
| **Design System & UX** | ✅ Functional | ~75% |
| **Business/Monetization** | ❌ Not Built | ~0% |

**Overall Platform Readiness: ~60%**

---

## Infrastructure & Auth (85%)

### What's Built
- Next.js 16 App Router with Turbopack dev server
- Supabase Auth (login/signup routes exist)
- Drizzle ORM schema with 17 tables including pgvector columns
- 5 SQL migration files (init → phase2 → autopsy/pulse → production hardening)
- Gemini AI wrapper (`lib/ai/gemini.ts`) with Flash + Pro model routing
- Retry logic with exponential backoff on all AI calls
- Anti-prompt-injection security boundary on all AI calls
- Streaming text support for chat interfaces
- Zod schema validation on AI JSON outputs
- Custom Zustand-like state store (`stores/appStore.ts`)
- CSS design system with 60+ tokens (dark theme, glassmorphism)
- Mobile responsive breakpoints
- Dashboard shell with Sidebar, Header, CommandBar (CMD+K), Toast system
- Server actions for auth, cognition, planner, revision, mistakes, onboarding, analytics, ingest, curriculum

### What's Missing / Needs Upgrade
- [ ] **Row Level Security (RLS):** Schema defined in Drizzle but no evidence RLS policies are deployed in Supabase. Vision specifies "isolated, RLS-protected tenant environments"
- [ ] **Edge deployment:** No `vercel.json` or edge runtime configs. Vision specifies "edge deployment via Vercel"
- [ ] **Offline resilience:** No service worker or local caching strategy. Vision says "offline-resilient"
- [ ] **Real Zustand:** Using a custom emulator (`stores/appStore.ts`), not the actual `zustand` package despite it being mentioned in vision
- [ ] **Rate limiting:** No API rate limiting on AI endpoints
- [ ] **Environment validation:** `.env.local` exists but no startup validation beyond `GEMINI_API_KEY`

---

## I. MIND — Socratic AI Tutor (70%)

### What's Built
- `lib/ai/prompts/tutor.ts` — Full Socratic Loop system prompt with 5-step protocol
- Adaptive difficulty based on mastery state and emotional state
- LaTeX/KaTeX support for math rendering
- Hallucination resistance instructions
- `lib/engines/student-context-engine.ts` — Builds deep context per session (exam info, weak areas, mistake history, revision urgency)
- `components/tutor/TutorChat.tsx` — Chat UI component
- `app/api/ai/tutor/` — Streaming API route
- `app/(dashboard)/tutor/` — Dashboard page
- RAG integration via `searchPersonalKnowledge()` — tutor can reference student's uploaded materials

### What's Missing / Needs Upgrade
- [ ] **Longitudinal conversation memory:** `tutorSessions` table exists but the tutor doesn't load past session history across days. Vision says "MIND remembers every conversation"
- [ ] **Cross-session concept tracking:** No mechanism to say "you asked about this 6 weeks ago." Sessions are isolated
- [ ] **Prerequisite chain diagnosis:** ATLAS has prerequisite links but MIND doesn't traverse them to find root conceptual gaps
- [ ] **Auto-card generation from tutor gaps:** Vision says "When MIND identifies a gap, it creates a card." No pipeline from tutor → MEMORY exists
- [ ] **Concept mastery updates from tutor:** Vision says tutor updates ATLAS. The `buildTutorContext` reads from ATLAS but never writes back

---

## II. COMMAND — Daily Mission Engine (75%)

### What's Built
- `lib/ai/agents/planner.ts` — Full AI-powered daily plan generator (154 lines)
- Ingests 7 parallel data streams: profile, weak concepts, current tasks, mistakes, due cards, performance snapshots, unfinished carryover tasks
- Adaptive workload calculation based on emotional state (0.4x–1.2x multiplier)
- FSRS revision prioritization when due cards > 0
- Heuristic fallback planner if AI fails (zero-downtime guarantee)
- Zod schema validation on AI output (`DailyMissionSchema`)
- `components/planner/DailyBriefing.tsx` + `PlannerDashboard.tsx` — UI components
- `components/dashboard/CommandCenter.tsx` — Main dashboard command center
- Task toggle (complete/uncomplete) with IDOR prevention

### What's Missing / Needs Upgrade
- [ ] **Morning Briefing synthesis:** Vision describes an overnight cron that synthesizes yesterday's performance into a "Morning Briefing." No cron job or scheduled function exists
- [ ] **"Good morning" narrative:** Vision describes a personalized greeting with days-to-exam, cognitive load %, specific hour recommendations. The planner generates tasks but not a narrative briefing
- [ ] **Time-of-day scheduling:** `scheduled_start_time` field exists in schema but planner doesn't assign specific time slots (e.g., "9:00 AM - 10:00 AM")
- [ ] **Calendar integration:** No external calendar sync
- [ ] **Multi-day planning:** Only generates day-by-day. No week-ahead view

---

## III. AUTOPSY — Mock Test Engine (65%)

### What's Built
- `lib/engines/autopsy-engine.ts` — Full multimodal OCR pipeline (158 lines)
- Supports text, PDF, and image uploads via Gemini 2.5 Flash
- Exponential backoff retry on multimodal extraction
- 9-category cognitive mistake taxonomy (conceptual, calculation, silly, time_pressure, misread, incomplete_knowledge, overconfidence, anxiety, recall_failure)
- Recoverable score calculation (filters silly/misread/time_pressure/recall_failure as recoverable)
- `lib/engines/mentor-engine.ts` — AI mentor quote generation + 3-day recovery sprint plan
- `autopsyQuestions` table with per-question granular data
- `recoveryPlans` table with structured sprint tasks
- `components/autopsy/ShareCard.tsx` — Viral share card component
- Exam-agnostic scoring via `getExamConfig()` + custom scoring override
- Batch insert in chunks of 50 for large tests

### What's Missing / Needs Upgrade
- [ ] **Actual PDF/OCR file upload route:** `app/api/autopsy/ingest/` directory exists but needs verification the route handles real multipart file uploads (Base64 → Gemini)
- [ ] **Autopsy → ATLAS sync:** When a question is marked incorrect on a chapter, it should downscale the mastery level in `concepts`. No pipeline connects autopsy results to `updateConceptState()`
- [ ] **Autopsy → MEMORY sync:** Vision says "AUTOPSY finds a mistake, it instantly creates a card." No auto-card creation from autopsy mistakes
- [ ] **Autopsy dashboard UI:** No dedicated `AutopsyDashboard.tsx` component showing the score bridge visualization (Actual → Recoverable → Potential)
- [ ] **OMR sheet detection:** Prompt mentions OMR but there's no specialized OMR grid detection logic
- [ ] **Anxiety/fatigue tagging from test timing:** No analysis of answer-time patterns across sections to detect time panic vs fatigue
- [ ] **Historical autopsy comparison:** No trend view showing score progression across multiple autopsies

---

## IV. ATLAS — Knowledge Graph (70%)

### What's Built
- `lib/engines/cognition-graph.ts` — Full graph engine (340 lines)
- 6-tier mastery classification: not_started → exposed → developing → proficient → mastered → automated
- `conceptLinks` table with prerequisite/related/confusion link types
- Prerequisite dependency auto-seeding (PREREQUISITES_MAP)
- Hybrid decay engine: FSRS retention formula + Ebbinghaus fallback
- Deep hierarchy grouping: Subject → Chapter → Topic → Concept
- Weak cluster detection (chapters with avg mastery < 40%)
- AI-powered cognition state analysis (`analyzeCognitionState`)
- `components/cognition/KnowledgeMap.tsx` (11KB) — Visual knowledge map
- `components/cognition/CognitionDashboard.tsx` (9KB) — Graph dashboard
- pgvector embeddings on concept nodes (768-dim)
- `seedConceptsForSubject()` with recursive micro-concept expansion
- `updateConceptState()` with prerequisite link strength propagation

### What's Missing / Needs Upgrade
- [ ] **Dynamic curriculum is limited:** `CHAPTER_EXPANSIONS` only covers ~6 chapters (Kinematics, Laws of Motion, etc.). Most chapters fall back to a single generic concept node
- [ ] **AI-generated concept expansion:** Vision implies the entire syllabus should be mapped into micro-concepts. Currently only hardcoded expansions exist for a handful of chapters
- [ ] **Interactive graph visualization:** `KnowledgeMap.tsx` exists but needs audit — is it a true interactive node-edge graph or a flat list? Vision describes "a living, breathing, visual map"
- [ ] **Forgetting heatmap animation:** Vision describes nodes shifting color dynamically. Needs CSS/animation work
- [ ] **Cross-module concept resolution:** When autopsy/mistakes reference a "chapter" by name, there's no fuzzy matching to resolve it to an existing concept node

---

## V. MEMORY — FSRS-5 Revision Engine (80%)

### What's Built
- `lib/engines/revision-engine.ts` — Full FSRS-5 implementation (216 lines)
- `ts-fsrs` library integrated with tuned weights and 90% target retention
- `getDueCards()` — Prioritizes overdue + highest difficulty
- `reviewCard()` — Full FSRS math cycle: fetch → compute → update card → log review → sync concept mastery → update daily performance snapshot
- `generateCardsForConcept()` — RAG-driven auto card generation from uploaded materials
- `getRevisionStats()` — Card state distribution (new/learning/review/mature)
- `components/revision/FlashCard.tsx` — Card review UI with flip animation
- `components/revision/RevisionDashboard.tsx` + `RevisionQueue.tsx` + `SessionComplete.tsx`
- `reviewLogs` table for full audit trail
- Concept mastery auto-sync on card review (stability → mastery tier mapping)

### What's Missing / Needs Upgrade
- [ ] **Auto-card from uploaded material at onboarding:** Vision says "you don't create flashcards — Cognition OS creates them from your uploaded material automatically." The `generateCardsForConcept` function exists but isn't triggered automatically during onboarding
- [ ] **Mistake-to-card pipeline:** Vision says autopsy mistakes should auto-create cards. No pipeline from `mistake_logs`/`autopsyQuestions` → `revision_cards`
- [ ] **Card quality review:** No mechanism for students to flag/edit AI-generated cards
- [ ] **Per-card retention visualization:** No UI showing individual card stability curves or next-review dates
- [ ] **Bulk card import/export:** No Anki import or CSV export

---

## VI. PULSE — Mental State Engine (50%)

### What's Built
- `lib/engines/pulse-engine.ts` — Friction-based detection system (128 lines)
- 4-state model: focused / neutral / frustrated / overwhelmed
- Multi-signal detection: accuracy drops, session abandonment, delayed task completion, repeated mistakes
- Weighted friction scoring (0–10 scale)
- Adaptive config per state: task caps, intensity, explanation depth, workload multiplier
- `pulseSignals` table for telemetry logging
- Profile emotional state sync
- `components/pulse/PulseCheckIn.tsx` — Self-report check-in UI
- Backward-compatible aliases

### What's Missing / Needs Upgrade
- [ ] **Typing pattern analysis:** Vision describes reading "typing patterns in the tutor." Not implemented
- [ ] **Real-time session monitoring:** No background timer tracking active study session duration or drop-off rates in real-time
- [ ] **Burnout prediction model:** Current system is reactive (detects friction after the fact). Vision describes predictive detection of "early signs of burnout"
- [ ] **Recovery mode UI:** Vision says the OS should "shift into support mode" — reduce targets, schedule recovery activities, change tutor tone. Only workload multiplier is implemented
- [ ] **Weekly trend visualization:** No PULSE dashboard showing emotional/cognitive trends over time
- [ ] **Response time on revision cards:** Vision mentions this as a signal. Not tracked currently
- [ ] **Mouse/touch jitter detection:** Vision mentions this. Not implemented (and arguably invasive)

---

## Cross-Module Integration (55%)

The vision's core differentiator is that all 6 modules share a single continuously-updated student model. Here's the integration status:

| Integration Path | Status | Notes |
|---|---|---|
| AUTOPSY → ATLAS (downscale mastery) | ❌ Not wired | Autopsy doesn't call `updateConceptState` |
| AUTOPSY → MEMORY (auto-create cards) | ❌ Not wired | No mistake-to-card pipeline |
| AUTOPSY → COMMAND (adjust tomorrow) | ⚠️ Indirect | Planner reads mistakes but not autopsy-specific data |
| MEMORY → ATLAS (update mastery on review) | ✅ Working | `reviewCard()` syncs concept mastery |
| MEMORY → COMMAND (due cards in plan) | ✅ Working | Planner fetches due card count |
| PULSE → COMMAND (adaptive workload) | ✅ Working | Emotional state reduces daily hours |
| PULSE → MIND (adjust tutor tone) | ⚠️ Partial | Context includes emotional state but no tone switching logic |
| MIND → ATLAS (update mastery from tutor) | ❌ Not wired | Tutor reads ATLAS but never writes |
| MIND → MEMORY (create cards from gaps) | ❌ Not wired | No tutor → card pipeline |
| ATLAS → COMMAND (weak spot injection) | ✅ Working | Planner fetches weak concepts |
| Inference Engine → All | ⚠️ Exists | `syncStudentModel` exists but not triggered automatically |

---

## Additional Systems

### RAG / Knowledge Base (60%)
- ✅ `rag-engine.ts` — Embedding generation via `text-embedding-004`
- ✅ `memory-engine.ts` — Document chunking and vector storage
- ✅ `searchPersonalKnowledge()` — pgvector similarity search via RPC
- ✅ `materials` + `material_chunks` tables with embeddings
- ✅ `KnowledgeBaseUI.tsx` — Upload interface
- [ ] **PDF parsing:** `app/api/ingest/route.ts` exists but only handles raw text. No PDF-to-text extraction (pdf.js, etc.)
- [ ] **Chunk size optimization:** Simple paragraph split. No semantic chunking or overlap

### Analytics (65%)
- ✅ `performance-engine.ts` — Score trends, subject mastery, mistake distribution, task completion, predicted score
- ✅ `AnalyticsDashboard.tsx` — Charts via Recharts
- ✅ `performanceSnapshots` table for daily aggregation
- [ ] **Exam countdown widget:** No days-remaining prominent display
- [ ] **Comparative analytics:** No percentile or cohort comparison

### Onboarding (70%)
- ✅ `DynamicCurriculumGenerator.tsx` — AI-generated curriculum for any topic
- ✅ `completeOnboarding()` — Seeds graph + generates Day 1 plan
- ✅ `seedKnowledgeGraph()` — Batch concept seeding
- [ ] **Material upload during onboarding:** Vision says "upload your material" during onboarding. Not in current flow
- [ ] **2-minute weak spot check:** No interactive quiz/assessment during onboarding
- [ ] **Magic moment:** Vision describes showing the knowledge map for the first time. No onboarding → ATLAS redirect

### Design & UX (75%)
- ✅ Premium dark theme with 60+ CSS tokens
- ✅ Inter font, glassmorphism variables
- ✅ Micro-animations (fadeIn, slideInLeft, pulse-glow, shimmer)
- ✅ Staggered child animations
- ✅ CMD+K global command bar
- ✅ Mobile responsive breakpoints
- ✅ Custom scrollbar styling
- [ ] **Accent color system incomplete:** Vision specifies "cyan for active, amber for warnings, purple for AI." CSS has these tokens but unclear if components use them consistently
- [ ] **Developer-tool aesthetic:** Vision references Linear/Raycast/Vercel. Needs UX polish pass

### Business & Monetization (0%)
- [ ] **Free tier gating:** No usage limits or paywall
- [ ] **Pro subscription:** No Stripe/payment integration
- [ ] **Teams plan:** No educator dashboard or multi-student views
- [ ] **Viral share cards:** `ShareCard.tsx` exists but no social sharing API integration

---

## Priority Upgrade Roadmap

### 🔴 P0 — Critical (Ship-blocking)

1. **Wire AUTOPSY → ATLAS → MEMORY pipeline** — The single most important missing integration. When an autopsy processes mistakes, it must: (a) downscale concept mastery in ATLAS, (b) auto-create FSRS cards in MEMORY
2. **Wire MIND → ATLAS write-back** — Tutor sessions must update concept mastery
3. **Deploy Supabase RLS policies** — Security requirement for any production launch
4. **PDF file upload & parsing** — Autopsy and Ingest both need real file handling

### 🟡 P1 — High (Core experience gaps)

5. **Longitudinal tutor memory** — Load past sessions so MIND can reference historical conversations
6. **Morning Briefing narrative** — Turn the daily plan into the compelling "Good morning" experience described in the vision
7. **Autopsy dashboard UI** — Build the Score Bridge visualization (most impressive feature for demos)
8. **PULSE weekly dashboard** — Visualize cognitive trends over time
9. **Auto-card generation on onboarding** — Generate FSRS cards from uploaded materials automatically
10. **Dynamic concept expansion** — Replace hardcoded `CHAPTER_EXPANSIONS` with AI-generated micro-concepts for any subject

### 🟢 P2 — Medium (Polish & differentiation)

11. **Onboarding magic moment** — Interactive weak-spot quiz → animated knowledge map reveal
12. **Cron-based overnight synthesis** — Scheduled function to run COMMAND + inference engine daily
13. **Interactive graph visualization** — D3.js or similar for the ATLAS node-edge graph
14. **Stripe integration** — Free/Pro/Teams tier gating
15. **Real Zustand migration** — Replace custom emulator with actual zustand package
16. **Typing/response-time PULSE signals** — Track tutor interaction patterns

### 🔵 P3 — Low (Future enhancements)

17. Offline PWA with service worker
18. Educator/Teams dashboard
19. Anki import/export
20. Calendar integration
21. Social sharing API for autopsy share cards
22. Edge runtime deployment
