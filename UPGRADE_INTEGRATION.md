# MODULE UPGRADE: Cross-Module Integration & Infrastructure

## Integration Pipelines (Total: 20-28 hrs)

### 1. AUTOPSY → ATLAS → MEMORY Pipeline (P0, 6-8 hrs)
The single most critical missing integration. When autopsy processes a test:
- Resolve each incorrect question's chapter to a concept node via fuzzy/semantic match
- Call `updateConceptState(conceptId, false, 0)` to downscale mastery
- Auto-generate FSRS cards for each incorrect question via `createCardFromMistake()`
- Files: `autopsy-engine.ts`, `revision-engine.ts`, new `concept-resolver.ts`

### 2. MIND → ATLAS + MEMORY Pipeline (P0, 4-6 hrs)
When tutor identifies a gap or confirms understanding:
- On successful Socratic exchange: `updateConceptState(conceptId, true, 0)`
- On identified gap: auto-create a flashcard via `createSingleCard()`
- Files: `app/api/ai/tutor/route.ts`, `revision-engine.ts`

### 3. Inference Engine Auto-Sync (P1, 3-4 hrs)
- Trigger `syncStudentModel()` after every autopsy completion
- Trigger after every 10th tutor session
- Wire into overnight cron job
- Files: `inference-engine.ts`, `autopsy-engine.ts`, cron route

### 4. Supabase RLS Policies (P0, 4-6 hrs)
- Deploy RLS policies for ALL 17 tables
- Every query must be scoped to `auth.uid() = user_id`
- Create migration `005_rls_policies.sql`

### 5. Real PDF Ingestion (P0, 3-4 hrs)
- Handle multipart file uploads in autopsy and ingest routes
- Convert PDF/images to base64 for Gemini
- Support drag-and-drop in UI

## Onboarding & UX Upgrades (Total: 12-16 hrs)

### 6. Material Upload During Onboarding (P1, 4-5 hrs)
- Add file upload step to DynamicCurriculumGenerator
- Process uploaded PDFs through RAG pipeline
- Auto-generate initial FSRS cards from materials

### 7. Onboarding Magic Moment (P2, 4-5 hrs)
- After curriculum seed, redirect to ATLAS with animated reveal
- Nodes appear one-by-one with staggered animations
- Subject clusters glow and connect with animated edges

### 8. Exam Countdown Widget (P1, 2-3 hrs)
- Prominent countdown using `exam_date` field from profiles
- Show in dashboard header and daily briefing
- Calculate days remaining dynamically

### 9. Stripe/Payment Integration (P2, 8-12 hrs)
- Free tier: 1 upload, 10 tutor Q/day, 1 autopsy/month
- Pro: $19/mo unlimited
- Teams: $49/mo/educator
- Usage tracking middleware
- Stripe Checkout + webhook handler

## Summary: Total Effort Across All Modules

| Module | Current | Target | Effort |
|--------|---------|--------|--------|
| MIND | 70% | 95% | 12-17 hrs |
| COMMAND | 75% | 95% | 9-13 hrs |
| AUTOPSY | 65% | 95% | 19-27 hrs |
| ATLAS | 70% | 95% | 25-33 hrs |
| MEMORY | 80% | 95% | 12-16 hrs |
| PULSE | 50% | 90% | 16-21 hrs |
| Integration | 55% | 90% | 20-28 hrs |
| Onboarding/UX | 70% | 90% | 12-16 hrs |
| Payments | 0% | 80% | 8-12 hrs |
| **TOTAL** | **~60%** | **~93%** | **133-183 hrs** |

**Estimated calendar time at full-time pace: 4-5 weeks**
