// lib/graph/knowledgeGraph.ts

/**
 * Placeholder knowledge graph implementation.
 * In a full system this would load a concept DAG from a database or file.
 * For now we provide a minimal API required by `masteryPropagation`.
 */
export interface ConceptGraph {
  /**
   * Return an array of prerequisite concept IDs for the given concept.
   * If the concept has no prerequisites, an empty array is returned.
   */
  getPrerequisites(conceptId: string): string[] | undefined;
}

/**
 * Returns a singleton stub graph.
 * The stub contains a hard‑coded small DAG for demonstration purposes.
 */
export async function getConceptGraph(): Promise<ConceptGraph> {
  // Simple in‑memory representation of a DAG.
  const prereqMap: Record<string, string[]> = {
    // Example: conceptB depends on conceptA, conceptC depends on A and B.
    'conceptB': ['conceptA'],
    'conceptC': ['conceptA', 'conceptB'],
    // Add more as needed for testing.
  };

  const graph: ConceptGraph = {
    getPrerequisites: (conceptId: string) => prereqMap[conceptId] ?? [],
  };

  return graph;
}
