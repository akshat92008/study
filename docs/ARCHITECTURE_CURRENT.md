# Cognition OS Current Architecture Map

Cognition OS is a memory-driven learning operating system. The core loop consists of users generating learning signals (through studying, chatting, uploading tests, making mistakes), which are diagnosed by Cognition, stored by Hermes, updated in ATLAS for concept mastery, reviewed in MEMORY via revision cards, and ultimately planned by COMMAND for the next session.

## Core Loop & Engines

- **Cognition**: Diagnoses the learning signal.
- **Hermes**: Stores useful memory and parses documents.
- **ATLAS**: Updates concept mastery.
- **MEMORY**: Creates and reviews revision cards.
- **COMMAND**: Changes the next session plan.

### Bounded Agents Infrastructure

The system employs a deterministic, database-backed bounded-agent infrastructure to run complex, durable operations without relying exclusively on premium LLMs.

Agents run asynchronously and track their state and actions in PostgreSQL tables:
- `agent_runs`: Tracks queued, running, completed, or failed agent runs with idempotency keys.
- `agent_actions`: Proposed or applied actions by agents, tracking risk level and approval states.
- `agent_action_approvals`: User-facing approvals for sensitive actions.
- `mastery_evidence_ledger`: A robust ledger for all concept mastery updates, ensuring traceable and deterministic progression.

Active Agents: `mind`, `rag`, `atlas`, `memory`, `autopsy`, `planner`, `command`, `system`

## Event Dispatch & Consumer Routing

All system side-effects and asynchronous processes are triggered via the Event Dispatcher, backed by PostgreSQL `event_queue` and `consumer_locks`. This ensures durability, automatic retries, idempotency, and visible contracts.

### Major Event Flows

Below are the most active flows mapping producers to consumers and defining the contracts. 

#### 1. Study Session & Mistake Extraction (Autopsy)
- **Producers**: User uploading mock test (`MOCK_TEST_UPLOADED`), `AUTOPSY_UPLOAD_RECEIVED`, `AUTOPSY_PROCESSING_COMPLETED`.
- **Consumers**: `autopsy_engine`, `autopsy_agent`, `planner_agent`, `command_agent`.
- **Visible Outcome**: User sees mistakes extracted and approved/rejected.
- **Idempotency/Fallback**: Bounded by `idempotency_key` in `event_queue`. Failed extraction sets autopsy state to error visibly.

#### 2. Mastery Updates (ATLAS)
- **Producers**: `MOCK_TEST_ANALYZED`, `AUTOPSY_MOCK_PROCESSED`, `STUDY_SESSION_COMPLETED`, `PRACTICE_ATTEMPT_RECORDED`.
- **Consumers**: `atlas_engine`, `learning_state_engine`, `atlas_agent`.
- **Visible Outcome**: Concept mastery bars update on the dashboard and in the syllabus. `mastery_evidence_ledger` acts as the source of truth.

#### 3. Revision Card Generation & Review (MEMORY)
- **Producers**: `MEMORY_CARD_CREATE_REQUESTED`, `AUTOPSY_MISTAKE_APPROVED`, `RAG_CARD_CANDIDATE_CREATED`.
- **Consumers**: `memory_agent`, `memory_engine`, `learning_state_engine`.
- **Visible Outcome**: New revision cards appear in the user's upcoming session. Reviewed cards impact ATLAS mastery and command planning.

#### 4. Chat & Tutoring (MIND)
- **Producers**: `CHAT_MESSAGE_CREATED`, `CHAT_MESSAGE_PROCESSED`, `MIND_ACTION_REQUESTED`, `CHAT_LEARNING_SIGNAL`.
- **Consumers**: `chat_side_effect_engine`, `mind_agent`, `learning_state_engine`, `atlas_agent`, `memory_agent`.
- **Visible Outcome**: Chat responses return to user; useful learning signals are extracted to form new concept links or mastery updates.

#### 5. Session Planning (COMMAND)
- **Producers**: `PLANNER_REPLAN_REQUESTED`, `SESSION_CARD_COMPLETED`, `LEARNER_STATE_CHANGED`, `STUDY_SESSION_COMPLETED`.
- **Consumers**: `planner_agent`, `command_agent`.
- **Visible Outcome**: The "Up Next" queue or daily plan changes dynamically based on the recent activities and learning signals.

#### 6. Document Ingestion (RAG)
- **Producers**: `MATERIAL_UPLOADED`, `MATERIAL_INGESTION_REQUESTED`.
- **Consumers**: `rag_agent`.
- **Visible Outcome**: Uploaded document goes through chunking and embedding (`rag_ingestion_jobs`), eventually linking to concepts (`material_concept_links`).

#### 7. Internal Quality Checks (Hermes)
- **Producers**: `HERMES_MISTAKE_REVIEW_REQUESTED`, `AUTOPSY_V3_REPORT_READY`, etc.
- **Consumers**: `hermes_worker`.
- **Visible Outcome**: Mostly audit-only/internal metrics. Improves parsing quality offline. Marked explicitly as `audit_only` or internal.

## Architectural Principles (Hardening Focus)

1. **Database-First Logic**: Events use Postgres (`event_queue`, `consumer_locks`) instead of external queues to ensure atomic boundaries. Rule-based logic takes precedence over LLMs.
2. **Idempotency**: All events and agent runs require unique idempotency keys based on data hashing to avoid duplicates.
3. **No Silent Failures**: All consumer operations must update a visible entity's state (e.g., status fields in `rag_ingestion_jobs`, `agent_runs`) or gracefully fallback.
4. **Rate Limiting & Pressure Guards**: The API limits daily event generation per user and coalesces noisy events (e.g., rapid chat messages) via a coalesce key.
