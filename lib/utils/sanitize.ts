// lib/utils/sanitize.ts
// Sanitize strings before use in LIKE/ILIKE Supabase queries.
// PostgREST parameterises the value itself, but we still need to
// escape % and _ so LLM-generated strings can't act as wildcards.

/**
 * Escapes LIKE metacharacters in a string so it can be safely
 * used inside an ilike() filter without unintended wildcard matching.
 *
 * Usage: .ilike('chapter', `%${sanitizeIlike(chapter)}%`)
 */
export function sanitizeIlike(value: string): string {
  if (!value || typeof value !== 'string') return '';
  // Escape LIKE special chars: % _ \
  return value
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .trim()
    .slice(0, 200); // hard cap on length to prevent absurdly long queries
}
