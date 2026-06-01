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

- [ ] Phase 1: Define Autopsy Evidence Contract (`lib/autopsy/types.ts`)
- [ ] Phase 2: Schema Hardening (Migration)
- [ ] Phase 3: Ingestion Conservative Rules (`app/api/autopsy/ingest/route.ts`)
- [ ] Phase 4: Mistake Classifier (`lib/autopsy/classifier.ts`)
- [ ] Phase 5: Transactional RPC / Service (`ingest_mock_autopsy`)
- [ ] Phase 6: Event Processing (`AUTOPSY_MOCK_PROCESSED`)
- [ ] Phase 7: Review / Correction Loop (`GET / PATCH` routes)
- [ ] Phase 8: MIND Context Integration
- [ ] Phase 9: UI Report
- [ ] Phase 10: Tests
- [ ] Phase 11: Validation

**Files Changed (to be updated):**
*(Empty prior to implementation)*

**Migrations Added (to be updated):**
*(Empty prior to implementation)*

**Tests Added (to be updated):**
*(Empty prior to implementation)*
