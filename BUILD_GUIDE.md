# COGNITION OS — Master Build Guide

## Product Name: Cognition OS
## Codename: NEETAPP (initial beachhead: NEET exam prep)

---

## FOR THE AI BUILDING THIS

You are a senior full-stack engineer building a production-grade AI-native academic operating system.
Follow each module file IN ORDER. Each module is self-contained with exact file paths, schemas, code, and prompts.
Do NOT skip steps. Do NOT improvise architecture. Follow the specifications exactly.

---

## Tech Stack (LOCKED — Do not change)

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Next.js 15 (App Router) | RSC, Server Actions, streaming |
| Language | TypeScript (strict mode) | Type safety across stack |
| Database | Supabase (PostgreSQL + pgvector) | Auth, RLS, realtime, vectors |
| ORM | Drizzle ORM | Type-safe, lightweight |
| AI | Google Gemini (via @google/genai SDK) | Primary AI provider |
| Spaced Rep | ts-fsrs | FSRS-5 algorithm |
| Styling | Vanilla CSS + CSS Variables | Premium dark theme, no Tailwind |
| Charts | Recharts | Performance dashboards |
| State | Zustand | Client state management |
| Deployment | Vercel | Edge-optimized |

---

## Project Structure (FINAL)

```
neetapp/
├── app/                          # Next.js App Router pages
│   ├── layout.tsx                # Root layout with providers
│   ├── page.tsx                  # Landing page
│   ├── globals.css               # Design system tokens
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx            # Dashboard shell
│   │   ├── page.tsx              # Main command center
│   │   ├── cognition/page.tsx    # Cognition graph view
│   │   ├── mistakes/page.tsx     # Mistake intelligence
│   │   ├── revision/page.tsx     # Revision engine
│   │   ├── mentor/page.tsx       # AI mentor chat
│   │   ├── planner/page.tsx      # Dynamic planner
│   │   ├── tutor/page.tsx        # AI tutor
│   │   └── analytics/page.tsx    # Performance analytics
│   └── api/
│       ├── ai/
│       │   ├── mentor/route.ts
│       │   ├── tutor/route.ts
│       │   ├── analyze/route.ts
│       │   └── planner/route.ts
│       ├── cognition/route.ts
│       ├── revision/route.ts
│       ├── mistakes/route.ts
│       └── ingest/route.ts
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── middleware.ts         # Auth middleware
│   ├── ai/
│   │   ├── gemini.ts             # Gemini client singleton
│   │   ├── agents/
│   │   │   ├── mentor.ts         # Mentor agent
│   │   │   ├── tutor.ts          # Tutor agent
│   │   │   ├── analyst.ts        # Analyst agent
│   │   │   ├── planner.ts        # Planner agent
│   │   │   └── revision-coach.ts # Revision coach agent
│   │   └── prompts/
│   │       ├── mentor.ts         # Mentor system prompts
│   │       ├── tutor.ts          # Tutor system prompts
│   │       ├── analyst.ts        # Analyst system prompts
│   │       └── planner.ts        # Planner system prompts
│   ├── engines/
│   │   ├── cognition-graph.ts    # Cognition graph engine
│   │   ├── mistake-engine.ts     # Mistake intelligence
│   │   ├── revision-engine.ts    # FSRS + adaptive revision
│   │   ├── memory-engine.ts      # Forgetting curve + retention
│   │   └── performance-engine.ts # Analytics + prediction
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema
│   │   └── migrations/           # SQL migrations
│   └── utils/
│       ├── types.ts              # Shared TypeScript types
│       └── constants.ts          # App constants
├── components/
│   ├── ui/                       # Primitive UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Modal.tsx
│   │   ├── Input.tsx
│   │   ├── Badge.tsx
│   │   ├── Progress.tsx
│   │   ├── Skeleton.tsx
│   │   └── Toast.tsx
│   ├── layout/
│   │   ├── Sidebar.tsx
│   │   ├── Header.tsx
│   │   └── CommandBar.tsx
│   ├── cognition/
│   │   ├── CognitionGraph.tsx
│   │   ├── KnowledgeNode.tsx
│   │   └── ConceptMap.tsx
│   ├── mistakes/
│   │   ├── MistakeCard.tsx
│   │   ├── PatternChart.tsx
│   │   └── MarkLossReport.tsx
│   ├── revision/
│   │   ├── RevisionQueue.tsx
│   │   ├── FlashCard.tsx
│   │   └── RetentionChart.tsx
│   ├── mentor/
│   │   ├── ChatInterface.tsx
│   │   ├── MentorMessage.tsx
│   │   └── InsightCard.tsx
│   ├── planner/
│   │   ├── DailyPlan.tsx
│   │   ├── WeekView.tsx
│   │   └── TaskCard.tsx
│   ├── analytics/
│   │   ├── ScoreTrend.tsx
│   │   ├── SubjectRadar.tsx
│   │   ├── RankPredictor.tsx
│   │   └── MomentumGauge.tsx
│   └── onboarding/
│       ├── ExamSelector.tsx
│       ├── SubjectSetup.tsx
│       └── GoalSetter.tsx
├── hooks/
│   ├── useSupabase.ts
│   ├── useCognition.ts
│   ├── useRevision.ts
│   └── useAnalytics.ts
├── stores/
│   ├── appStore.ts
│   ├── cognitionStore.ts
│   └── sessionStore.ts
├── public/
│   └── fonts/
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── .env.local
```

---

## Build Order (STRICT — Follow this sequence)

| # | Module File | What It Builds | Estimated Time |
|---|------------|-----------------|----------------|
| 0 | `modules/MODULE_0_SCAFFOLD.md` | Project init, deps, env, Supabase | 30 min |
| 1 | `modules/MODULE_1_DESIGN_SYSTEM.md` | CSS tokens, dark theme, UI primitives | 45 min |
| 2 | `modules/MODULE_2_AUTH.md` | Supabase auth, login/signup, middleware | 30 min |
| 3 | `modules/MODULE_3_DATABASE.md` | All Drizzle schemas, migrations, RLS | 45 min |
| 4 | `modules/MODULE_4_DASHBOARD_SHELL.md` | Layout, sidebar, header, routing | 30 min |
| 5 | `modules/MODULE_5_COGNITION_GRAPH.md` | Student cognition graph engine + UI | 60 min |
| 6 | `modules/MODULE_6_MISTAKE_ENGINE.md` | Mistake intelligence engine + UI | 60 min |
| 7 | `modules/MODULE_7_REVISION_ENGINE.md` | FSRS spaced repetition + UI | 60 min |
| 8 | `modules/MODULE_8_AI_MENTOR.md` | AI mentor chat system | 60 min |
| 9 | `modules/MODULE_9_PLANNER.md` | Dynamic academic planner | 45 min |
| 10 | `modules/MODULE_10_TUTOR.md` | AI tutor with adaptive teaching | 45 min |
| 11 | `modules/MODULE_11_ANALYTICS.md` | Performance analytics dashboard | 45 min |
| 12 | `modules/MODULE_12_INGEST.md` | Input layer (PDF, mock tests, notes) | 45 min |
| 13 | `modules/MODULE_13_COMMAND_CENTER.md` | Main dashboard command center | 30 min |
| 14 | `modules/MODULE_14_ONBOARDING.md` | User onboarding flow | 30 min |
| 15 | `modules/MODULE_15_LANDING.md` | Landing page (marketing) | 30 min |

---

## Critical Rules for AI Builders

1. **NEVER use Tailwind CSS.** Use vanilla CSS with CSS custom properties.
2. **NEVER use `any` type in TypeScript.** Define proper interfaces.
3. **ALWAYS use Server Components by default.** Only add `'use client'` when needed.
4. **ALWAYS use Server Actions for mutations.** Not API routes.
5. **ALWAYS apply RLS policies on every table.**
6. **Use Gemini Flash for fast operations, Gemini Pro for complex reasoning.**
7. **Every component must have a unique `id` attribute for testing.**
8. **Follow the exact file paths specified.** Do not reorganize.
9. **Dark mode is the DEFAULT and ONLY theme.**
10. **The UI must feel like Bloomberg Terminal meets F1 telemetry.** Premium, data-dense, intelligent.

---

## Environment Variables Required

```env
# .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
GEMINI_API_KEY=your_gemini_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## How to Use This Guide

1. Open each module file in order (MODULE_0 → MODULE_15)
2. Copy the EXACT prompt at the top of each module into your AI tool (Gemini, etc.)
3. The AI will receive complete specifications: schemas, code patterns, file paths
4. Build each module, verify it works, then move to the next
5. Each module has a VERIFICATION section — complete it before proceeding

---

## Product Philosophy Reminders

- This is NOT an "edtech app." This is a COGNITIVE OPERATING SYSTEM.
- The UI should feel like a trading terminal for learning — data-dense, intelligent, premium.
- Every interaction generates data. Every data point improves the system.
- The student should feel: "This system understands my preparation better than I do."
- Dark, moody, futuristic. Think Bloomberg + F1 + Notion + Claude combined.
