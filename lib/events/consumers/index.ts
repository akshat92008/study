// lib/events/consumers/index.ts
// REAL event consumer registry — routes to the actual engine consumers.
// These are wired to the EventDispatcher in lib/events/orchestrator.ts.
// If you need to add a consumer, add it to EVENT_CONSUMERS there and add a case to routeToConsumer.

// This file is intentionally minimal.
// All consumer logic is in the engine files:
//   - learning_state_engine: lib/engines/learning-state-engine.ts
//   - atlas_engine:          lib/engines/cognition-graph.ts (AtlasConsumer)
//   - memory_engine:         lib/engines/revision-engine.ts (MemoryConsumer)
//   - autopsy_engine:        lib/services/autopsy-jobs.ts
//   - concept_expansion:     lib/engines/concept-expansion-engine.ts (ConceptExpansionConsumer)
//
// Do NOT add consumers here that insert into raw event tracking tables.
// The consumer_locks table is managed by the EventDispatcher/worker path.

export { EVENT_CONSUMERS as EVENT_CONSUMER_NAMES, type EventConsumer as EventConsumerName } from '@/lib/events/routes';
