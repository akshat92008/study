import { featureFlags } from '@/lib/feature-registry';
import type { AgentActionType, AgentRiskLevel, JsonRecord } from './types';

// For the Private Beta, we are EXTREMELY conservative with autonomous agent actions.
// Most actions are routed to a human admin or wait for the user.

export const ALLOWED_BETA_ACTIONS = new Set<string>([
  'create_revision_card_from_verified_mistake',
  'update_mastery_from_evidence',
  'invalidate_session_card',
]);

// We disable 'auto_with_undo' for the beta and push them to 'requires_approval' 
// to prevent unexpected state changes for the first 100 users.

export function classifyAgentActionRisk(
  actionType: AgentActionType,
  _confidence?: number | null,
  _evidence: JsonRecord = {}
): AgentRiskLevel {
  void _confidence;
  void _evidence;

  if (ALLOWED_BETA_ACTIONS.has(actionType)) {
    return 'safe_auto';
  }

  // Everything else requires approval in the beta
  return 'requires_approval';
}

export function assertBetaAgentActionAllowed(action: string) {
  if (!featureFlags.agentActions()) {
    return {
      allowed: false,
      reason: 'Agent actions are disabled for beta stability.',
    };
  }

  if (!ALLOWED_BETA_ACTIONS.has(action)) {
    return {
      allowed: false,
      reason: `Agent action ${action} is not allowed in beta.`,
    };
  }

  return { allowed: true };
}
