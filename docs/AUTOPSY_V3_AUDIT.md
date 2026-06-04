# Autopsy V3 Audit

## Existing Autopsy Functionality That Works

- `app/api/autopsy/ingest/route.ts` accepts structured text, PDFs, images, and form uploads, validates ownership context, rate limits uploads, and creates async `autopsy_jobs`.
- `lib/services/autopsy-jobs.ts` provides idempotent job creation and worker processing through the existing event queue.
- `lib/engines/autopsy-engine.ts` and the `ingest_mock_autopsy` RPC persist legacy `mock_autopsies`, `autopsy_questions`, and verified mistakes.
- `app/api/autopsy/manual/route.ts` supports a single manual missed-question pathway with Hermes when enabled and fallback behavior when Hermes fails or is disabled.
- `app/api/autopsy/route.ts` and `app/(dashboard)/autopsy/page.tsx` read the latest legacy autopsy and surface mistake category/chapter loss summaries.

## Existing Comeback, Revision, And Dashboard Functionality To Reuse

- `app/api/dashboard/route.ts` loads stored cognition, revision, mistake, and daily microtask state without AI calls.
- `components/dashboard/CurrentTaskCard.tsx` and `components/dashboard/MicrotargetsCard.tsx` already represent daily mission output.
- `lib/engines/revision-engine.ts` creates and reviews `revision_cards`; review routes already update cards and publish events.
- `app/api/practice/attempts/route.ts` records practice attempts and publishes `PRACTICE_ATTEMPT_RECORDED`.
- `app/api/materials/upload/route.ts` already enforces upload limits and publishes source/material events.

## Existing Hermes Functionality To Reuse

- `lib/hermes/index.ts` exposes the public Hermes interface and keeps agent internals private.
- `app/api/autopsy/manual/route.ts` uses `runHermesMistakeAgent`, `buildMistakeFallback`, and `writeMistakeResult` safely.
- `lib/hermes/hermes-config.ts` makes Hermes optional.
- Hermes worker event types exist for mistake, source, revision, trace, and next-action work.

## Existing Event Types Related To Mistakes, Revision, Planner, And Memory

- Autopsy and mistake events: `AUTOPSY_UPLOAD_RECEIVED`, `AUTOPSY_PROCESSING_COMPLETED`, `AUTOPSY_MISTAKE_EXTRACTED`, `AUTOPSY_MISTAKE_APPROVED`, `AUTOPSY_MOCK_PROCESSED`.
- Revision and memory events: `MEMORY_CARD_CREATE_REQUESTED`, `MEMORY_CARD_CREATED`, `MEMORY_CARD_REVIEWED`, `REVISION_CARD_REVIEWED`, `REVISION_COMPLETED`.
- Planner/dashboard refresh events: `PLANNER_REPLAN_REQUESTED`, `SESSION_RECOMMENDATION_REQUESTED`, `SESSION_CARD_COMPLETED`, `LEARNER_STATE_CHANGED`.
- Non-test learning events: `CHAT_LEARNING_SIGNAL`, `MATERIAL_UPLOADED`, `MATERIAL_INGESTED`, `PRACTICE_ATTEMPT_RECORDED`, `PRACTICE_ATTEMPT_SUBMITTED`.

## Existing DB Tables To Reuse

- Mistakes/autopsy: `mock_autopsies`, `autopsy_questions`, `mistakes`, `autopsy_jobs`.
- Revision: `revision_cards`, `revision_logs`.
- Events: `event_queue`, `consumer_locks`, `student_events`, `event_consumer_tracking`.
- Materials: `study_materials`, `study_material_chunks`, legacy `materials`, `material_chunks`.
- Attempts/tests: `practice_sets`, `practice_items`, `practice_attempts`, legacy `mock_autopsies`.
- Memory: `chat_memory`, `learner_states`, Hermes adapter-written concept/revision memory paths.

## Missing Pieces

- No first-class assessment table that handles worksheets, quizzes, practice, assignments, and custom non-mock inputs.
- No durable Hermes-style mistake-pattern memory table designed for reminder retrieval.
- No deterministic full-report generator independent of AI.
- No central Autopsy V3 limits for report count, PDF size, question count, and memory write caps.
- No manual structured multi-question assessment workflow.
- No generic `learning_signals` persistence layer for non-test input pathways.
- No dashboard card for stored Deep Autopsy state.

## Fragile Pieces

- Legacy PDF/image autopsy depends on expensive extraction and diagnosis paths, then falls back only after job/extraction handling.
- `app/api/autopsy/manual/route.ts` deterministic fallback still uses AI calls when Hermes is disabled, so it is not a no-AI baseline.
- Event routing is strict. New V3 event names must be registered in both TypeScript and the DB RPC.
- Existing UI language still leans on "mock test" in some places.

## Duplicate Or Obsolete Flows

- `lib/services/autopsy.service.ts` is an intentional deprecated stub.
- Legacy `mock_autopsies` is still useful for current UI compatibility but is not general enough for V3.
- Manual missed-question logging and upload autopsy are separate flows; V3 should keep them compatible but not rebuild them.

## Security Risks

- Every new user-owned table needs RLS, not just route checks.
- Upload paths and extracted text must stay user-scoped.
- Service-role clients must remain server-only.
- Dashboard must only read stored report/memory rows and must not trigger AI or Hermes calls.

## Cost Risks

- One AI/Hermes call per question would be too expensive. V3 should generate deterministic reports first.
- PDF/OCR can become costly and unreliable. Launch scope should support selectable-text PDFs and manual fallback.
- Memory writes should be capped per report.
- Daily assessment, upload, and report caps should be enforced at route level.

## Final Implementation Plan

1. Add additive V3 tables: `assessments`, `assessment_questions`, `mistake_diagnoses`, `hermes_learning_memories`, `autopsy_reports`, and `learning_signals`.
2. Add pure deterministic Autopsy V3 libraries for scoring, classification, pattern detection, recoverable marks, report generation, PDF text extraction, answer-key parsing, limits, and memory retrieval.
3. Add authenticated V3 routes for assessments, questions, reasons, report generation, upload/extract fallback, answer keys, reminders, and self-reflection.
4. Persist learning signals from Autopsy V3 plus minimal source upload, practice/revision, chat confusion, and self-reflection pathways.
5. Add a Deep Autopsy UI route and a dashboard card that reads stored report/memory rows only.
6. Add docs, env vars, focused tests, and validation.
