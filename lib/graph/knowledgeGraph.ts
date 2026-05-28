// lib/graph/knowledgeGraph.ts
// Real implementation: loads prerequisite data from the concepts/concept_links tables.
// Replaces the 3-node hardcoded stub.

import { createAdminClient } from '@/lib/supabase/admin';

export interface ConceptGraph {
  getPrerequisites(conceptId: string): string[];
  getDependents(conceptId: string): string[];
  hasPath(fromId: string, toId: string): boolean;
}

interface ConceptLink {
  from_concept_id: string;
  to_concept_id: string;
  link_type: string;
}

class LiveConceptGraph implements ConceptGraph {
  // prerequisiteMap: conceptId → array of concept IDs it depends on
  private prerequisiteMap: Map<string, string[]> = new Map();
  // dependentMap: conceptId → array of concept IDs that depend on it
  private dependentMap: Map<string, string[]> = new Map();

  constructor(links: ConceptLink[]) {
    for (const link of links) {
      if (link.link_type !== 'prerequisite') continue;

      // from_concept_id is the prerequisite, to_concept_id is the dependent
      if (!this.prerequisiteMap.has(link.to_concept_id)) {
        this.prerequisiteMap.set(link.to_concept_id, []);
      }
      this.prerequisiteMap.get(link.to_concept_id)!.push(link.from_concept_id);

      if (!this.dependentMap.has(link.from_concept_id)) {
        this.dependentMap.set(link.from_concept_id, []);
      }
      this.dependentMap.get(link.from_concept_id)!.push(link.to_concept_id);
    }
  }

  getPrerequisites(conceptId: string): string[] {
    return this.prerequisiteMap.get(conceptId) ?? [];
  }

  getDependents(conceptId: string): string[] {
    return this.dependentMap.get(conceptId) ?? [];
  }

  hasPath(fromId: string, toId: string): boolean {
    // BFS from fromId following dependent edges
    const visited = new Set<string>();
    const queue = [fromId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === toId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const dependents = this.getDependents(current);
      queue.push(...dependents);
    }
    return false;
  }
}

// Cache the graph for 5 minutes so we're not hitting Supabase on every call
let _cachedGraph: LiveConceptGraph | null = null;
let _cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000;

export async function getConceptGraph(): Promise<ConceptGraph> {
  const now = Date.now();
  if (_cachedGraph && now < _cacheExpiry) {
    return _cachedGraph;
  }

  try {
    const supabase = createAdminClient();
    const { data: links, error } = await supabase
      .from('concept_links')
      .select('from_concept_id, to_concept_id, link_type');

    if (error) {
      console.error('[ConceptGraph] Failed to load links from DB:', error);
      // Return empty graph rather than crashing
      return new LiveConceptGraph([]);
    }

    _cachedGraph = new LiveConceptGraph(links ?? []);
    _cacheExpiry = now + CACHE_TTL_MS;
    return _cachedGraph;
  } catch (err) {
    console.error('[ConceptGraph] Unexpected error loading graph:', err);
    return new LiveConceptGraph([]);
  }
}

// Call this when concept_links are modified so the cache refreshes
export function invalidateConceptGraphCache(): void {
  _cachedGraph = null;
  _cacheExpiry = 0;
}
