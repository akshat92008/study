# HOW TO USE THESE MODULES WITH GEMINI

## Quick Start

1. Open Google AI Studio or your Gemini interface
2. Start a NEW conversation for each module
3. Copy this system instruction first:

---

## System Instruction (Paste This First in Every Session)

```
You are a senior full-stack engineer building "Cognition OS" — an AI-native academic operating system.

Tech Stack (DO NOT CHANGE):
- Next.js 15 (App Router, TypeScript, strict mode)
- Supabase (PostgreSQL + pgvector + Auth + RLS)
- Google Gemini (@google/genai SDK)
- ts-fsrs (FSRS-5 spaced repetition)
- Vanilla CSS with CSS custom properties (NO Tailwind)
- Recharts for charts
- Zustand for client state
- lucide-react for icons
- framer-motion for animations

Project directory: /Users/ashishsingh/Desktop/neetapp

Rules:
1. Follow the module specification EXACTLY — do not improvise
2. Create every file at the exact path specified
3. Use CSS variables (var(--bg-secondary), etc.) for ALL styling
4. NEVER use Tailwind CSS
5. NEVER use the `any` TypeScript type where avoidable
6. Use Server Components by default, 'use client' only when needed
7. Dark theme only — Bloomberg Terminal aesthetic
8. Every interactive element needs a unique id attribute
9. Test after each step before moving on
```

---

## Then For Each Module

Paste:
```
Read the following module specification and implement it step by step.
Create every file exactly as specified. After each step, confirm what you created.
Do not skip any steps. Do not modify the architecture.

[PASTE THE ENTIRE MODULE CONTENT HERE]
```

---

## Build Order Checklist

- [ ] MODULE 0: Scaffold (init project, deps, env, clients)
- [ ] MODULE 1: Design System (CSS tokens, UI primitives)
- [ ] MODULE 2: Auth (login, signup, middleware)
- [ ] MODULE 3: Database (schemas, migration SQL, RLS)
- [ ] MODULE 4: Dashboard Shell (sidebar, header, layout)
- [ ] MODULE 5: Cognition Graph (engine + UI)
- [ ] MODULE 6: Mistake Engine (engine + UI)
- [ ] MODULE 7: Revision Engine (FSRS + UI)
- [ ] MODULE 8: AI Mentor (streaming chat + prompts)
- [ ] MODULE 9: Planner (AI daily plans + UI)
- [ ] MODULE 10: AI Tutor (adaptive teaching + UI)
- [ ] MODULE 11: Analytics (charts + dashboard)
- [ ] MODULE 12: Ingest (mock test form)
- [ ] MODULE 13: Command Center (main dashboard)
- [ ] MODULE 14-15: Onboarding + Landing Page

---

## Tips for Best Results with Gemini

1. **One module per conversation** — don't try to build multiple modules in one session
2. **Paste the FULL module content** — don't summarize, Gemini needs the exact code
3. **If it deviates, correct immediately** — say "Follow the spec exactly, do not improvise"
4. **Verify each step** — run `npm run dev` and check before moving on
5. **If errors occur** — paste the error message and say "Fix this error, maintain the spec"
6. **For Module 3 (Database)** — run the SQL in Supabase Dashboard manually, don't rely on Drizzle migrations for initial setup
7. **Before starting** — make sure you have:
   - Supabase project URL + keys
   - Gemini API key
   - Node.js >= 20 installed

---

## Estimated Total Build Time

| Phase | Modules | Time |
|-------|---------|------|
| Foundation | 0-2 | ~1.5 hours |
| Database + Layout | 3-4 | ~1 hour |
| Core Engines | 5-7 | ~3 hours |
| AI Agents | 8-10 | ~2.5 hours |
| Analytics + Polish | 11-15 | ~3 hours |
| **TOTAL** | | **~11 hours** |

---

## After Building

Run these final checks:
```bash
# TypeScript check
npx tsc --noEmit

# Dev server
npm run dev

# Test all routes:
# / (landing page)
# /login, /signup
# /dashboard (command center)
# /dashboard/cognition
# /dashboard/mistakes
# /dashboard/revision
# /dashboard/mentor
# /dashboard/planner
# /dashboard/tutor
# /dashboard/analytics
# /dashboard/analytics/log-test
# /dashboard/onboarding
```
