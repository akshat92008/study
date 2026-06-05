# Cognition OS System Boundaries

This document defines the beta-safe ownership boundaries for the existing systems. It is intentionally conservative for the 100-user controlled beta.

## MIND

- Owned files: `app/api/ai/chat/route.ts`, `lib/chat/*`, `lib/ai/*`, chat persistence services.
- Owned tables: `chat_sessions`, `chat_messages`, `message_citations`.
- Allowed side effects: persist chat turns, attach owned RAG citations, enqueue bounded learning side effects.
- Not allowed: uncontrolled background work, cross-user context reads, raw provider errors.
- Expensive operations: AI provider calls and optional title/prose generation.
- Feature flags: `AI_GLOBAL_KILL_SWITCH`, `RAG_QUERIES_ENABLED`, `HERMES_WRITES_ENABLED`.
- Failure mode: deterministic/rule-first response when possible; otherwise safe API error.

## Autopsy V3

- Owned files: `app/api/autopsy/v3/*`, `lib/autopsy-v3/*`, `components/autopsy-v3/*`.
- Owned tables: `assessments`, `assessment_questions`, `mistake_diagnoses`, `autopsy_reports`.
- Allowed side effects: write deterministic report, capped Hermes memories, capped revision cards, daily recovery task, learning signals.
- Not allowed: Autopsy V2, duplicate report/card/memory/task side effects, OCR expansion in beta.
- Expensive operations: PDF extraction, report generation, optional Hermes/revision side effects.
- Feature flags: `AUTOPSY_UPLOADS_ENABLED`, `AUTOPSY_REPORTS_ENABLED`, `HERMES_WRITES_ENABLED`, `REVISION_ENABLED`.
- Failure mode: idempotent retry; Hermes/revision failures are non-fatal where possible.

## Hermes Lite

- Owned files: `lib/hermes/*`, `lib/autopsy-v3/hermes-memory-writer.ts`.
- Owned tables: `hermes_learning_memories`.
- Allowed side effects: compact learning memories and capped chat memory retrieval.
- Not allowed: autonomous agent loop, source processing by default, background AI unless `WORKER_AI_ENABLED=true`.
- Expensive operations: Hermes agents and memory scoring.
- Feature flags: `HERMES_ENABLED`, `HERMES_MODE=lite`, `HERMES_WRITES_ENABLED`, `WORKER_AI_ENABLED`.
- Failure mode: skip or fallback without blocking core Autopsy/report flow.

## COMMAND

- Owned files: `app/api/dashboard/session-card/route.ts`, `app/api/dashboard/microtasks/route.ts`, session-card services.
- Owned tables: `session_cards`, `daily_microtasks`.
- Allowed side effects: deterministic daily card cache and bounded microtasks.
- Not allowed: AI dependency for the card structure or duplicate microtasks.
- Expensive operations: optional LLM prose only.
- Feature flags: `SESSION_CARD_ENABLED`, `AI_GLOBAL_KILL_SWITCH`.
- Failure mode: deterministic card without AI prose.

## MEMORY / Revision

- Owned files: `app/api/revision/*`, `lib/engines/revision-engine.ts`, `lib/engines/mistake-to-card.ts`.
- Owned tables: `revision_cards`, `revision_logs`.
- Allowed side effects: review scheduling, capped Autopsy-generated cards.
- Not allowed: duplicate cards from report retries, cross-user card mutation.
- Expensive operations: AI flashcard generation only if explicitly budget-gated.
- Feature flags: `REVISION_ENABLED`.
- Failure mode: invalid cards are skipped or safely reported without corrupting the batch.

## ATLAS

- Owned files: `lib/engines/cognition-graph.ts`, `lib/engines/mastery-updater.ts`, `lib/topic-seeding/*`, ATLAS routes/components.
- Owned tables: `concepts`, `concept_mastery`, `mastery_events`, `learning_signals`, `seeded_topics`.
- Allowed side effects: deterministic mastery updates from learning signals.
- Not allowed: AI calls or expensive seeding in request path.
- Feature flags: `ATLAS_ENABLED`.
- Failure mode: no-data fallback; ATLAS must not block Autopsy, chat, or revision.

## RAG

- Owned files: `app/api/materials/*`, `lib/rag/*`.
- Owned tables: `study_materials`, `study_material_chunks`, `rag_ingestion_jobs`, `rag_query_logs`.
- Allowed side effects: user-scoped upload, chunking, retrieval, citations.
- Not allowed: public storage leakage, cross-user query, unlimited ingestion.
- Expensive operations: file extraction, embeddings, AI answer synthesis.
- Feature flags: `RAG_UPLOADS_ENABLED`, `RAG_QUERIES_ENABLED`, `AI_GLOBAL_KILL_SWITCH`.
- Failure mode: material status becomes `failed` or query returns a safe unavailable response.

## Events And Workers

- Owned files: `app/api/internal/workers/*`, `lib/events/*`.
- Owned tables: `event_queue`, `consumer_locks`, `event_attempts`, `event_dlq`.
- Allowed side effects: bounded async work, idempotent consumers, DLQ retry.
- Not allowed: unbounded processing, worker AI by default, poison events blocking the queue.
- Feature flags: `BACKGROUND_JOBS_ENABLED`, `WORKER_AI_ENABLED`.
- Failure mode: retry with capped attempts, then DLQ with admin visibility.
