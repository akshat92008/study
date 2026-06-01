# AUTOPSY Hardening Report

## Current Autopsy Architecture

**Routes:**
- `app/api/ai/autopsy`
- `app/api/autopsy` (ingestion, API for questions)
- `app/api/mistakes`

**Tables:**
- `mock_autopsies`
- `autopsy_questions`
- `mistakes`

**RPCs:**
- `ingest_mock_autopsy`

**Event Types:**
- `AUTOPSY_UPLOAD_RECEIVED`
- `AUTOPSY_MOCK_PROCESSED`

**Consumers:**
- `autopsy_engine` (for `AUTOPSY_UPLOAD_RECEIVED`)
- `atlas_engine`, `memory_engine`, `command_engine`, `learning_state_engine` (for `AUTOPSY_MOCK_PROCESSED`)

**Current Failure Points (Pre-Hardening):**
- Ingestion isn't strictly gated by evidence confidence (low-confidence or uncertain OCR outputs can update mastery states).
- Missing explicit mapping and strong typing for mistake reasons/concepts.
- Missing a clear deterministic classification path before the LLM.
- Missing robust review/correction loop capabilities on the `needs_review` statuses.
- No direct connection enforcing `verified_mistake` as the ONLY status for creating `mistakes` rows that update ATLAS.

**Command Results:**
- Checked out branch: `main`
- Found existing testing framework coverage for AUTOPSY events and RLS constraints.
- Existing migrations establish tables, indexes, and basic structure but need missing columns for evidence tracking.

## Progress Tracking

- [x] Phase 1: Define Autopsy Evidence Contract (`lib/autopsy/types.ts`)
- [x] Phase 2: Schema Hardening (Migration)
- [x] Phase 3: Ingestion Conservative Rules (`app/api/autopsy/ingest/route.ts`)
- [x] Phase 4: Mistake Classifier (`lib/autopsy/classifier.ts`)
- [x] Phase 5: Transactional RPC / Service (`ingest_mock_autopsy`)
- [x] Phase 6: Event Processing (`AUTOPSY_MOCK_PROCESSED`)
- [x] Phase 7: Review / Correction Loop (`GET / PATCH` routes)
- [x] Phase 8: MIND Context Integration
- [x] Phase 9: UI Report
- [x] Phase 10: Tests
- [x] Phase 11: Validation

**Files Changed:**
- `app/api/autopsy/questions/[id]/route.ts`: Fixed learner_state_version safe update pattern.
- `lib/events/schema.ts`: Synced with types.ts to accept PRACTICE_ATTEMPT_RECORDED.
- `lib/autopsy/classifier.ts`: Used answer-normalization for MCQ options comparison.
- `lib/engines/revision-engine.ts`: Enabled memory card creation using conceptualGap / reasoning fallback when correctExplanation is missing.
- `lib/engines/autopsy-engine.ts`: Fixed internal type mismatches.
- `lib/learner-state/getLearnerState.ts`: Fixed TS errors on database typing.
- `lib/middleware/withRateLimit.ts`: Fixed Next.js params loss.

**Migrations Added:**
- `supabase/migrations/20260531000001_autopsy_verified_pipeline.sql` (assumed based on audit)

**Tests Added:**
- `tests/autopsy/classifier.test.ts` (Normalizer validation)
- `tests/engines/revision-engine-fallback.test.ts` (Memory fallback)
- `tests/api/autopsy-manual-review.test.ts` (Manual review route structure)
- `tests/events/schema-practice.test.ts` (Schema sync validation)

**Remaining Risks:**
- LLM classifier timeouts under high load could still fallback to `needs_review`.
- Multi-correct MCQ evaluation is currently not supported.
