// lib/ai/task-complexity.ts
// Regex-based task complexity classifier — zero AI cost.
//
// Purpose: route simple queries to the smallest/cheapest model tier,
// and only escalate to larger models for genuinely complex requests.
//
// Used by providers.ts routing to modulate provider selection.

export type TaskComplexity = 'simple' | 'medium' | 'complex';

// ─── PATTERNS ─────────────────────────────────────────────────────────────────

// Simple: single-concept factual questions that can be answered from memory
const SIMPLE_RE = new RegExp(
  '\\b(' +
  'define|definition of|what is|what are|who is|when did|where is' +
  '|formula for|give the formula|state the|list the' +
  '|full form of|expand|abbreviation for|meaning of' +
  '|unit of|si unit|how many|how much' +
  '|spell|correct spelling|synonym|antonym' +
  ')\\b',
  'i'
);

// Complex: multi-step generation or analysis tasks
const COMPLEX_RE = new RegExp(
  '\\b(' +
  'generate.*\\d{2,}.*(?:mcq|question|flashcard)|' +  // "generate 90 MCQs"
  '\\d{2,}.*(?:mcq|question|flashcard).*generate|' +
  'create.*mock.*test|full.*mock.*test|mock.*test.*full|' +
  'full.*(?:chapter|unit|module).*(?:plan|notes|summary)|' +
  'compare.*(?:chapter|unit|topic).*(?:with|and|vs)|' +
  'comprehensive.*(?:analysis|plan|notes|guide)|' +
  'autopsy.*(?:full|complete|detailed)|' +
  'analyse.*(?:test|result|paper)|' +
  'explain.*entire|entire.*(?:chapter|unit|syllabus)|' +
  'multi.*(?:chapter|topic)|cross.*chapter|integrated.*question' +
  ')\\b',
  'i'
);

// Large count detection (e.g. "give me 50 questions")
const LARGE_COUNT_RE = /\b([3-9]\d|1\d{2,})\s+(mcq|question|flashcard|problem|sum|example)/i;

// Keywords that suggest medium complexity (multi-step reasoning needed)
const MEDIUM_RE = new RegExp(
  '\\b(' +
  'explain|summarize|compare|differentiate|difference between|' +
  'step by step|how does|why does|derive|proof of|' +
  'generate.*(?:mcq|question|flashcard)|' +
  'make.*(?:notes|plan|guide)|create.*(?:flashcard|summary)|' +
  'study plan|revision plan|practice question|diagram|' +
  'analyse|evaluate|justify' +
  ')\\b',
  'i'
);

// ─── PUBLIC API ───────────────────────────────────────────────────────────────

/**
 * Classify the complexity of a user input without calling any AI.
 *
 * - simple:  can be answered with a single-fact lookup; route to smallest model
 * - medium:  requires explanation or multi-step generation; mid-tier model
 * - complex: large-scale generation/analysis; may need a larger model
 */
export function detectTaskComplexity(input: string): TaskComplexity {
  if (!input || input.trim().length < 5) return 'simple';

  const trimmed = input.trim();

  // Very short inputs are almost always simple
  if (trimmed.length < 40 && !MEDIUM_RE.test(trimmed)) return 'simple';

  if (COMPLEX_RE.test(trimmed) || LARGE_COUNT_RE.test(trimmed)) return 'complex';
  if (SIMPLE_RE.test(trimmed) && trimmed.length < 120) return 'simple';
  if (MEDIUM_RE.test(trimmed)) return 'medium';

  // Longer inputs without medium/complex signals — still medium
  if (trimmed.length > 300) return 'medium';

  return 'simple';
}

/**
 * Whether the task complexity warrants using a larger model.
 * In ultra_cheap mode, only 'complex' warrants escalation.
 */
export function shouldUseHigherTierModel(
  complexity: TaskComplexity,
  costMode: string
): boolean {
  if (costMode === 'ultra_cheap') return complexity === 'complex';
  if (costMode === 'cheap') return complexity !== 'simple';
  return true; // balanced/quality always allow higher tier
}
