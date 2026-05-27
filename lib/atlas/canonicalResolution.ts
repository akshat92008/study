// lib/atlas/canonicalResolution.ts
/**
 * Resolve a list of concept names to a single canonical concept record.
 * Normalises the names (lower‑case, trim, remove punctuation) and attempts to
 * find an existing concept with the same normalised key. If multiple candidates
 * exist, picks the one with the highest mastery_score for the given user (or the
 * earliest created_at if no user context is supplied).
 */
import { createClient } from '@/lib/supabase/server';

export function normaliseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[\.,;:!\?\-]/g, '');
}

/**
 * Resolve to a canonical concept ID.
 * Returns the existing concept ID if found, otherwise creates a new concept
 * with the first supplied name.
 */
export async function resolveCanonicalConcept(params: {
  userId?: string; // optional – used for mastery‑score tie‑break
  names: string[];
  description?: string;
}) {
  const supabase = await createClient();
  const normMap = new Map<string, string>(); // norm → original
  for (const n of params.names) {
    normMap.set(normaliseName(n), n);
  }
  const normNames = Array.from(normMap.keys());

  // Search for any concept whose name (or alias) matches a normalised name.
  const { data: existing, error } = await supabase
    .from('concepts')
    .select('id, name, created_at, mastery_score')
    .in('normalised_name', normNames);

  if (error) throw error;

  if (existing && existing.length > 0) {
    // Choose best candidate
    let best = existing[0];
    for (const c of existing) {
      // Prefer higher mastery_score if userId provided
      if (params.userId && (c as any).mastery_score > (best as any).mastery_score) {
        best = c;
      } else if (!params.userId && new Date(c.created_at) < new Date(best.created_at)) {
        best = c;
      }
    }
    return best.id as string;
  }

  // No existing concept – create a new one using the first name
  const firstName = params.names[0];
  const { data: newConcept, error: insertErr } = await supabase
    .from('concepts')
    .insert({
      name: firstName,
      description: params.description ?? '',
      normalised_name: normaliseName(firstName),
    })
    .select('id')
    .single();

  if (insertErr) throw insertErr;
  return newConcept.id as string;
}
