// lib/events/consumers/index.ts
// REAL event consumer registry — routes to the actual engine consumers.
// These are wired to the EventDispatcher in lib/events/orchestrator.ts.
// If you need to add a consumer, add it to EVENT_CONSUMERS there and add a case to routeToConsumer.

// This file is intentionally minimal.
// All consumer logic is in the engine files:
//   - learning_state_engine: lib/engines/learning-state-engine.ts
//   - atlas_engine:          lib/engines/cognition-graph.ts (AtlasConsumer)
//   - memory_engine:         lib/engines/revision-engine.ts (MemoryConsumer)
//   - command_engine:        lib/engines/command-engine.ts (CommandConsumer)
//   - concept_expansion:     lib/engines/concept-expansion-engine.ts (ConceptExpansionConsumer)
//
// Do NOT add consumers here that insert into raw event tracking tables.
// The consumer_locks table is managed by the EventDispatcher/worker path.

export const EVENT_CONSUMER_NAMES = [
  'learning_state_engine',
  'atlas_engine',
  'memory_engine',
  'command_engine',
  'concept_expansion_engine',
  'chat_side_effect_engine',
] as const;

export type EventConsumerName = typeof EVENT_CONSUMER_NAMES[number];
