// lib/hermes/index.ts
// Public exports for the Hermes internal module.
// Only import from this file outside lib/hermes/.
// Do NOT import agent internals directly from other modules.

// Config
export { getHermesConfig, isHermesEnabled } from './hermes-config';

// Types
export type {
  HermesFeature,
  HermesModelTier,
  HermesMistakeInput,
  HermesMistakeResult,
  HermesMistakeCategory,
  HermesCard,
  HermesNextAction,
  HermesSourceInput,
  HermesSourceResult,
  HermesRevisionInput,
  HermesRevisionResult,
  HermesTraceInput,
  HermesTraceResult,
  HermesNextActionInput,
  HermesNextActionResult,
  WriteMistakeResultInput,
  WriteMistakeResultOutput,
} from './hermes-types';

// Errors
export {
  HermesDisabledError,
  HermesAgentError,
  HermesSchemaError,
  HermesTimeoutError,
  HermesBudgetError,
  isHermesError,
} from './hermes-errors';

// Schemas
export { HermesMistakeResultSchema } from './schemas/mistake.schema';
export { HermesSourceResultSchema } from './schemas/source.schema';
export { HermesRevisionResultSchema } from './schemas/revision.schema';
export { HermesTraceResultSchema } from './schemas/trace.schema';
export { HermesNextActionResultSchema } from './schemas/next-action.schema';

// Agents
export {
  runHermesMistakeAgent,
  buildMistakeFallback,
} from './agents/mistake-agent';
export { runHermesRevisionAgent } from './agents/revision-agent';
export { runHermesSourceAgent } from './agents/source-agent';
export { runHermesTraceAgent } from './agents/trace-agent';
export { runHermesNextActionAgent } from './agents/next-action-agent';

// DB Writer
export { writeMistakeResult, writeSourceResult } from './adapters/cognition-db-writer';

// Event Adapter
export {
  buildMistakeEventPayload,
  buildSourceEventPayload,
  buildTraceEventPayload,
} from './adapters/event-adapter';
