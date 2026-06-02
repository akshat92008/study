import type { AgentActionType, AgentRiskLevel, JsonRecord } from './types';

// For the Private Beta, we are EXTREMELY conservative with autonomous agent actions.
// Most actions are routed to a human admin or wait for the user.

const SAFE_AUTO = new Set<AgentActionType>([
  'create_rag_ingestion_job',
  'extract_document_text',
  'chunk_document',
  'embed_chunks',
  'store_citation',
  'log_source_usage',
  // Low-risk read-only or scoped creation
  'create_session_recommendation',
]);

// We disable 'auto_with_undo' for the beta and push them to 'requires_approval' 
// to prevent unexpected state changes for the first 100 users.

export function classifyAgentActionRisk(
  actionType: AgentActionType,
  confidence?: number | null,
  evidence: JsonRecord = {}
): AgentRiskLevel {
  // If it's explicitly in the safe auto list, check confidence
  if (SAFE_AUTO.has(actionType)) {
    const evidenceConfidence = numberFrom(evidence.confidence);
    const effectiveConfidence = confidence ?? evidenceConfidence;
    
    // Even "safe" actions require high confidence in Beta
    if (effectiveConfidence !== null && effectiveConfidence >= 0.85) {
      return 'safe_auto';
    }
  }

  // Everything else requires approval in the beta
  return 'requires_approval';
}

function numberFrom(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
