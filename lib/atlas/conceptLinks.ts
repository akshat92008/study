// lib/atlas/conceptLinks.ts
/**
 * Centralised definition of the column names used for concept links (prerequisite graph).
 * Keeping them in one place prevents mismatched field names across the codebase.
 */
export const ConceptLinkFields = {
  // The concept that is a prerequisite for another concept
  prerequisiteId: 'source_concept_id',
  // The concept that depends on the prerequisite
  dependentId: 'target_concept_id',
  // Optional weight or strength of the prerequisite relationship
  weight: 'strength',
};

// Export a type for TypeScript safety when building queries
export type ConceptLink = {
  [ConceptLinkFields.prerequisiteId]: string;
  [ConceptLinkFields.dependentId]: string;
  [ConceptLinkFields.weight]?: number;
};
