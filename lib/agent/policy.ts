/**
 * Policy definitions for the agent runtime.
 * Defines which tools/toolsets are allowed per channel and per risk level.
 */
import type { AgentChannel, JsonObject } from './types';

export type Toolset =
  | 'learner_context_read'
  | 'source_read'
  | 'diagnosis'
  | 'atlas_write'
  | 'memory_write'
  | 'mission_write'
  | 'activity_write'
  | 'practice_write'
  | 'session_write'
  | 'autopsy_write'
  | 'skills_write';

export type RiskLevel = 'safe_read' | 'safe_write' | 'learner_visible_write' | 'approval_required' | 'admin_only';

export interface ChannelPolicy {
  allowedToolsets: Toolset[];
  allowedRiskLevels: RiskLevel[];
  maxToolsPerTurn: number;
  allowModelPlanning: boolean;
}

/**
 * Channel-specific policy definitions.
 * These define the guardrails for each execution channel.
 */
export const ChannelPolicies: Record<AgentChannel, ChannelPolicy> = {
  chat: {
    allowedToolsets: [
      'learner_context_read',
      'source_read',
      'diagnosis',
      'atlas_write',
      'memory_write',
      'mission_write',
      'activity_write',
    ],
    allowedRiskLevels: ['safe_read', 'safe_write', 'learner_visible_write'],
    maxToolsPerTurn: 10,
    allowModelPlanning: true,
  },
  practice: {
    allowedToolsets: [
      'learner_context_read',
      'diagnosis',
      'atlas_write',
      'memory_write',
      'mission_write',
      'activity_write',
      'practice_write',
    ],
    allowedRiskLevels: ['safe_read', 'safe_write', 'learner_visible_write'],
    maxToolsPerTurn: 10,
    allowModelPlanning: true,
  },
  autopsy: {
    allowedToolsets: [
      'learner_context_read',
      'source_read',
      'diagnosis',
      'atlas_write',
      'memory_write',
      'mission_write',
      'activity_write',
      'autopsy_write',
      'skills_write',
    ],
    allowedRiskLevels: ['safe_read', 'safe_write', 'learner_visible_write'],
    maxToolsPerTurn: 12,
    allowModelPlanning: true,
  },
  revision: {
    allowedToolsets: [
      'learner_context_read',
      'source_read',
      'memory_write',
      'mission_write',
      'activity_write',
    ],
    allowedRiskLevels: ['safe_read', 'safe_write', 'learner_visible_write'],
    maxToolsPerTurn: 6,
    allowModelPlanning: true,
  },
  session: {
    allowedToolsets: [
      'learner_context_read',
      'source_read',
      'atlas_write',
      'memory_write',
      'mission_write',
      'activity_write',
      'session_write',
    ],
    allowedRiskLevels: ['safe_read', 'safe_write', 'learner_visible_write'],
    maxToolsPerTurn: 8,
    allowModelPlanning: false, // Session completion is deterministic
  },
  background: {
    allowedToolsets: [
      'learner_context_read',
      'source_read',
      'diagnosis',
      'atlas_write',
      'memory_write',
      'mission_write',
      'activity_write',
      'skills_write',
    ],
    allowedRiskLevels: ['safe_read', 'safe_write'],
    maxToolsPerTurn: 8,
    allowModelPlanning: true,
  },
};

/**
 * Get policy for a specific channel
 */
export function getChannelPolicy(channel: AgentChannel): ChannelPolicy {
  return ChannelPolicies[channel] ?? ChannelPolicies.chat;
}

/**
 * Check if a toolset is allowed for a channel
 */
export function isToolsetAllowedForChannel(channel: AgentChannel, toolset: Toolset): boolean {
  const policy = getChannelPolicy(channel);
  return policy.allowedToolsets.includes(toolset);
}

/**
 * Check if a risk level is allowed for a channel
 */
export function isRiskLevelAllowedForChannel(channel: AgentChannel, riskLevel: RiskLevel): boolean {
  const policy = getChannelPolicy(channel);
  return policy.allowedRiskLevels.includes(riskLevel);
}

/**
 * Policy enforcement result
 */
export interface PolicyCheckResult {
  allowed: boolean;
  reason?: string;
  requiresApproval?: boolean;
}

/**
 * Enforce all policies for a tool selection
 */
export function enforceToolPolicy(input: {
  channel: AgentChannel;
  toolName: string;
  toolset: Toolset;
  riskLevel: RiskLevel;
  mutating: boolean;
  channelPolicy?: ChannelPolicy;
}): PolicyCheckResult {
  const policy = input.channelPolicy ?? getChannelPolicy(input.channel);

  // Check toolset
  if (!policy.allowedToolsets.includes(input.toolset)) {
    return {
      allowed: false,
      reason: `Toolset '${input.toolset}' is not allowed for channel '${input.channel}'`,
    };
  }

  // Check risk level
  if (!policy.allowedRiskLevels.includes(input.riskLevel)) {
    if (input.riskLevel === 'admin_only') {
      return { allowed: false, reason: 'This tool requires admin access' };
    }
    if (input.riskLevel === 'approval_required') {
      return {
        allowed: true,
        reason: `Tool requires approval for channel '${input.channel}'`,
        requiresApproval: true,
      };
    }
    return {
      allowed: false,
      reason: `Risk level '${input.riskLevel}' is not allowed for channel '${input.channel}'`,
    };
  }

  return { allowed: true };
}

/**
 * User ownership policy - all data access must be scoped by user_id
 */
export function enforceOwnershipPolicy(input: {
  resourceUserId: string;
  requestUserId: string;
  resourceType: string;
}): PolicyCheckResult {
  if (input.resourceUserId !== input.requestUserId) {
    return {
      allowed: false,
      reason: `Cross-user access denied: ${input.resourceType} belongs to different user`,
    };
  }
  return { allowed: true };
}

/**
 * Mutation policy - enforce that only registered tools can mutate state
 * LLM cannot choose arbitrary DB table/column names
 */
export function enforceMutationPolicy(input: {
  toolName: string;
  knownMutatingTools: Set<string>;
}): PolicyCheckResult {
  if (!input.knownMutatingTools.has(input.toolName)) {
    return {
      allowed: false,
      reason: `Tool '${input.toolName}' is not registered as a mutating tool`,
    };
  }
  return { allowed: true };
}

/**
 * Get all allowed tool names for a channel from the tool registry
 */
export function getAllowedToolNames(channel: AgentChannel, allToolConfigs: Array<{ name: string; toolset: Toolset; riskLevel: RiskLevel }>): string[] {
  const policy = getChannelPolicy(channel);
  return allToolConfigs
    .filter(cfg =>
      policy.allowedToolsets.includes(cfg.toolset) &&
      policy.allowedRiskLevels.includes(cfg.riskLevel)
    )
    .map(cfg => cfg.name);
}