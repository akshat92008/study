// lib/ai/fallback.ts
// OpenRouter has been removed entirely.
// All provider logic is now in lib/ai/router.ts
// This file is kept only for any legacy imports — 
// it re-exports from the router.

export { 
  routeTextGeneration as generateWithGroq,
  routeStreamGeneration as streamWithGroq,
  routeJSONGeneration as generateJSONWithGroq,
} from './router';