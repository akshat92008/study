/**
 * EVENT-DRIVEN INVALIDATION PATCH
 * ================================
 * This file documents + implements the wiring between each event type and
 * session card invalidation.
 *
 * IMPORTANT: This is NOT a standalone engine. It is a diff/patch guide showing:
 *   (a) Which engines already call invalidateSessionCards ✓
 *   (b) Which event types were NOT yet connected ✗ and need the call added
 *   (c) The canonical import path to use going forward
 *
 * All engines should import from the new canonical service:
 *   import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
 *
 * ─── CURRENT STATE (before this patch) ───────────────────────────────────────
 *
 *   revision-engine.ts         ✓  already calls invalidateSessionCards()
 *   command-engine.ts          ✓  already calls invalidateSessionCards()
 *   cognition-graph.ts         ✓  already calls invalidateSessionCards() (partially)
 *   mastery-updater.ts         ✓  already calls invalidateSessionCards()
 *   learning-state-engine.ts   ✗  MISSING — handles STUDY_SESSION_COMPLETED,
 *                                  MEMORY_CARD_REVIEWED but does NOT invalidate
 *   autopsy-engine.ts          ✗  MISSING — the ingest_mock_autopsy RPC deletes
 *                                  rows directly in SQL, but the TS event consumer
 *                                  path (AUTOPSY_MOCK_PROCESSED) does NOT call
 *                                  invalidateSessionCard from the consumer
 *
 * ─── PATCH INSTRUCTIONS ──────────────────────────────────────────────────────
 *
 * 1. In lib/engines/learning-state-engine.ts, add after the learner state
 *    incremental update for STUDY_SESSION_COMPLETED and MEMORY_CARD_REVIEWED.
 *
 * 2. In lib/engines/command-engine.ts (CommandConsumer.handleStudySessionCompleted),
 *    pass skipVersionBump: true since complete_study_session RPC already bumps it.
 *
 * 3. Replace all imports of session-card-cache with session-card-invalidation
 *    to consolidate the API.
 *
 * See the actual patch functions below.
 */

// ─── Canonical import ────────────────────────────────────────────────────────

// All engines should use this import going forward:
export { invalidateSessionCard, invalidateSessionCards } from './session-card-invalidation';

// ─── Patch 1: learning-state-engine.ts additions ─────────────────────────────
//
// Add the following to LearningStateEngine.ingestEvent() after the
// `update_learner_state_incrementally` rpc call, inside the event routing:
//
// ```typescript
// // --- SESSION CARD INVALIDATION ---
// // These events change learner state enough to warrant regenerating today's card.
// const INVALIDATING_EVENT_TYPES = new Set([
//   'STUDY_SESSION_COMPLETED',
//   'COMMAND_SESSION_COMPLETED',
//   'MIND_TUTOR_COMPLETED',
//   'MEMORY_CARD_REVIEWED',      // only if rating = 1 (again) or 4 (easy)
//   'AUTOPSY_MOCK_PROCESSED',
//   'ATLAS_MASTERY_UPDATED',
// ]);
//
// const shouldInvalidate =
//   INVALIDATING_EVENT_TYPES.has(type) &&
//   // For MEMORY_CARD_REVIEWED, only invalidate on significant ratings
//   (type !== 'MEMORY_CARD_REVIEWED' || data.rating === 1 || data.rating === 4);
//
// if (shouldInvalidate) {
//   await invalidateSessionCard(userId, type as any, {
//     skipVersionBump: true, // LearningStateEngine already bumped it via RPC
//     client: supabase,
//   }).catch(err =>
//     logger.warn('LearningStateEngine: failed to invalidate session card', { type, err })
//   );
// }
// ```

// ─── Patch 2: Replace legacy import in all engines ───────────────────────────
//
// OLD:  import { invalidateSessionCards } from '@/lib/services/session-card-cache';
// NEW:  import { invalidateSessionCard } from '@/lib/services/session-card-invalidation';
//
// The new function signature is:
//   invalidateSessionCard(userId, reason, { skipVersionBump?, client? })
//
// Backward-compatible shim:
//   invalidateSessionCards(userId, client?, reason?) → maps to new API
// (exported from session-card-invalidation.ts for drop-in compatibility)

// ─── Patch 3: command-engine.ts skipVersionBump ───────────────────────────────
//
// The complete_study_session RPC already increments learner_state_version in SQL.
// When the TS command-engine then calls invalidateSessionCards(), it bumps again
// (double increment). Fix:
//
// ```typescript
// // In CommandConsumer.handleStudySessionCompleted:
// await invalidateSessionCard(userId, 'STUDY_SESSION_COMPLETED', {
//   skipVersionBump: true,  // ← ADD THIS
//   client: supabase,
// }).catch(err => logger.warn('CommandConsumer: invalidation failed', err));
// ```
//
// Similarly for CommandConsumer.handleAutopsyProcessed:
// ```typescript
// await invalidateSessionCard(userId, 'AUTOPSY_COMPLETED', {
//   skipVersionBump: true,
//   client: supabase,
// }).catch(err => logger.warn('CommandConsumer: invalidation failed', err));
// ```

// ─── Loop-break guarantees ────────────────────────────────────────────────────
//
// Potential loop: A→B→A where:
//   A = invalidateSessionCard (bumps version)
//   B = session card GET (triggered by version change)
//   This is NOT a loop because:
//     (1) invalidateSessionCard only DELETES the row — it doesn't call GET.
//     (2) The GET endpoint only fires when the USER requests the page.
//     (3) The GET endpoint does NOT publish any events.
//
// The only risky loop is in revision-engine.ts:
//   reviewCard → recordMasteryEvidence → (may publish ATLAS_MASTERY_UPDATED)
//   → learning-state-engine handles it → invalidateSessionCard
//   → no further events fired ✓
//
// Guard: invalidateSessionCard is idempotent (deletes 0 rows gracefully if
// already deleted) and never fires events of its own.

// ─── Event → invalidation mapping table ──────────────────────────────────────
//
// Event                       | Who handles it         | skipVersionBump
// ----------------------------|------------------------|----------------
// STUDY_SESSION_COMPLETED     | command-engine (RPC)   | true  (RPC bumps)
// AUTOPSY_COMPLETED           | command-engine         | true  (RPC bumps)
// REVISION_CARD_REVIEWED      | revision-engine (loop-breaker only) | false
//                             | learning-state (all)   | true  (LSE already bumps)
// CONCEPT_MASTERY_UPDATED     | mastery-updater        | false
// ATLAS_MASTERY_UPDATED       | learning-state-engine  | true
// LEARNER_STATE_UPDATED       | (direct profile write) | true  (caller bumps)
