import { featureFlags } from '@/lib/config/flags';
import type { CheapAgentAction, CheapAgentRiskLevel } from './cheap-types';
import { ALLOWED_BETA_ACTIONS } from './beta-policy';

const SAFE_AUTO_APPLY_ACTIONS = new Set([
  ...ALLOWED_BETA_ACTIONS,
]);

const APPROVAL_REQUIRED_ACTIONS = new Set([
  'replace_daily_plan',
  'skip_chapter',
  'reduce_test_frequency',
  'run_full_material_analysis',
  'run_vision_interpretation',
  'change_exam_strategy',
  'generate_large_strategy_plan',
]);

export function classifyAgentAction(actionType: string): {
  riskLevel: CheapAgentRiskLevel;
  autoApply: boolean;
} {
  if (SAFE_AUTO_APPLY_ACTIONS.has(actionType)) {
    return { riskLevel: 'safe', autoApply: true };
  }

  if (APPROVAL_REQUIRED_ACTIONS.has(actionType)) {
    return { riskLevel: actionType === 'change_exam_strategy' ? 'high' : 'medium', autoApply: false };
  }

  return { riskLevel: 'medium', autoApply: false };
}

export function shouldSkipAgentMutation(): boolean {
  return !featureFlags.agentActions();
}

export function normalizeActionPolicy(action: CheapAgentAction) {
  const policy = classifyAgentAction(action.actionType);
  const riskLevel = action.riskLevel ?? policy.riskLevel;
  return {
    riskLevel,
    autoApply: policy.autoApply && riskLevel === 'safe',
  };
}

export function isAiEscalationEnabled() {
  return featureFlags.aiEscalation();
}
