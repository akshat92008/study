// lib/engines/atlas-integration.ts
// Bridge module: re-exports the correct functions under the names
// that autopsy-engine.ts dynamically imports at runtime.
// This file exists solely to give the dynamic import a real target.

export { resolveConceptByName } from './concept-resolver';
export { updateConceptState } from './cognition-graph';
export { createSingleCard } from './revision-engine';
