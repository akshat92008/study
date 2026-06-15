/**
 * Toolset definitions - groups tools by functional area.
 * Used by policy to determine which tools are allowed per channel.
 */
import type { Toolset, RiskLevel } from '../policy';

export interface ToolConfig {
  name: string;
  toolset: Toolset;
  riskLevel: RiskLevel;
  mutating: boolean;
  description: string;
}

/**
 * All registered tools and their associated toolset.
 * This is the authoritative list for policy enforcement.
 */
export const TOOL_CONFIGS: ToolConfig[] = [
  // learner_context_read tools
  {
    name: 'get_learner_context',
    toolset: 'learner_context_read',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Load learner profile, goals, ATLAS concepts, MEMORY state, and sources',
  },
  {
    name: 'read_trajectory_context',
    toolset: 'learner_context_read',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Load recent trajectory context for current planning',
  },

  // source_read tools
  {
    name: 'retrieve_source_chunks',
    toolset: 'source_read',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Retrieve relevant source chunks from uploaded study materials',
  },

  // diagnosis tools
  {
    name: 'extract_learning_signals',
    toolset: 'diagnosis',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Analyze user messages for learning signals (weak areas, misconceptions, etc.)',
  },
  {
    name: 'diagnose_weak_areas',
    toolset: 'diagnosis',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Infer related weak concepts from detected signals',
  },

  // atlas_write tools
  {
    name: 'verify_weak_area_state',
    toolset: 'atlas_write',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Verify ATLAS concept state after mutations',
  },

  // mission_write tools
  {
    name: 'update_microtarget',
    toolset: 'mission_write',
    riskLevel: 'safe_write',
    mutating: true,
    description: 'Update daily microtarget progress',
  },
  {
    name: 'adapt_daily_plan',
    toolset: 'mission_write',
    riskLevel: 'safe_write',
    mutating: true,
    description: 'Adapt the daily learning plan based on current state',
  },
  {
    name: 'propose_next_action',
    toolset: 'mission_write',
    riskLevel: 'learner_visible_write',
    mutating: true,
    description: 'Propose and persist the next learning action',
  },

  // activity_write tools
  {
    name: 'write_learning_event',
    toolset: 'activity_write',
    riskLevel: 'safe_write',
    mutating: true,
    description: 'Atomically project learning evidence into learner state, repair, cards, activity, and notifications',
  },

  // practice_write tools
  {
    name: 'apply_practice_attempt',
    toolset: 'practice_write',
    riskLevel: 'learner_visible_write',
    mutating: true,
    description: 'Process a practice attempt submission',
  },

  // session_write tools
  {
    name: 'complete_session',
    toolset: 'session_write',
    riskLevel: 'learner_visible_write',
    mutating: true,
    description: 'Complete a study session and update streak/mastery',
  },

  // autopsy_write tools
  {
    name: 'record_autopsy_mistake',
    toolset: 'autopsy_write',
    riskLevel: 'learner_visible_write',
    mutating: true,
    description: 'Record a mistake classification from autopsy',
  },

  // skills_write tools
  {
    name: 'create_agent_skill',
    toolset: 'skills_write',
    riskLevel: 'safe_write',
    mutating: true,
    description: 'Create a durable agent skill for repeated repair patterns',
  },
  {
    name: 'mark_skill_used',
    toolset: 'skills_write',
    riskLevel: 'safe_write',
    mutating: true,
    description: 'Mark a skill as used and update success/failure count',
  },
  {
    name: 'retrieve_agent_skills',
    toolset: 'skills_write',
    riskLevel: 'safe_read',
    mutating: false,
    description: 'Retrieve relevant skills for the current context',
  },
];

// Map name -> config for quick lookup
const TOOL_CONFIG_MAP = new Map(TOOL_CONFIGS.map(c => [c.name, c]));

export function getToolConfig(name: string): ToolConfig | undefined {
  return TOOL_CONFIG_MAP.get(name);
}

export function getToolsetForTool(name: string): Toolset | undefined {
  return TOOL_CONFIG_MAP.get(name)?.toolset;
}

export function getRiskLevelForTool(name: string): RiskLevel | undefined {
  return TOOL_CONFIG_MAP.get(name)?.riskLevel;
}

export function isToolMutating(name: string): boolean {
  return TOOL_CONFIG_MAP.get(name)?.mutating ?? false;
}

export function getAllToolNames(): string[] {
  return TOOL_CONFIGS.map(c => c.name);
}

export function getMutatingToolNames(): string[] {
  return TOOL_CONFIGS.filter(c => c.mutating).map(c => c.name);
}
