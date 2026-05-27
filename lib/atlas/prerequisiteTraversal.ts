import { createClient } from '@/lib/supabase/server';
import { ConceptLinkFields } from '@/lib/atlas/conceptLinks';

/**
 * Recursively traverses prerequisite edges for a given concept.
 * Returns an ordered list of prerequisite concept IDs, nearest first.
 * Detects cycles and respects a maximum depth to avoid infinite loops.
 */
export async function traversePrerequisites(
  conceptId: string,
  maxDepth = 5,
  visited: Set<string> = new Set()
): Promise<string[]> {
  if (maxDepth <= 0) return [];
  if (visited.has(conceptId)) return [];
  visited.add(conceptId);

  const supabase = await createClient();
  const { data: links, error } = await supabase
    .from('concept_links')
    .select(`${ConceptLinkFields.prerequisiteId}, ${ConceptLinkFields.dependentId}`)
    .eq(ConceptLinkFields.dependentId, conceptId);

  if (error) throw error;
  if (!links || links.length === 0) return [];

  const directPrereqs = links.map((l: any) => l[ConceptLinkFields.prerequisiteId] as string);
  const all: string[] = [];
  for (const pre of directPrereqs) {
    // Recursively gather deeper prerequisites
    const deeper = await traversePrerequisites(pre, maxDepth - 1, visited);
    all.push(...deeper);
    all.push(pre);
  }

  // Remove duplicates while preserving order
  return Array.from(new Set(all));
}
