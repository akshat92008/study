/**
 * Skill Types for Cognition OS agent skills.
 * Skills are durable procedural learning repair patterns.
 */
import type { JsonObject } from '../types';

export type SkillScope = 'global' | 'user' | 'goal' | 'concept';
export type SkillStatus = 'draft' | 'active' | 'archived' | 'disabled';

export interface AgentSkillTrigger {
  conceptName?: string | null;
  signalTypes?: string[];
  repeatedCount?: number;
  channel?: string[];
  [key: string]: unknown;
}

export interface AgentSkill {
  id: string;
  user_id: string | null;
  goal_id: string | null;
  concept_id: string | null;
  scope: SkillScope;
  name: string;
  description: string | null;
  trigger: AgentSkillTrigger;
  procedure: string;
  source_run_id: string | null;
  source_event_id: string | null;
  status: SkillStatus;
  success_count: number;
  failure_count: number;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SkillMatch {
  skill: AgentSkill;
  matchScore: number;
  matchReason: string;
}

export function createSkillRecord(input: {
  userId: string;
  name: string;
  description?: string;
  trigger: AgentSkillTrigger;
  procedure: string;
  scope?: SkillScope;
  goalId?: string | null;
  conceptId?: string | null;
  sourceRunId?: string | null;
}): Omit<AgentSkill, 'id' | 'created_at' | 'updated_at'> {
  return {
    user_id: input.userId,
    goal_id: input.goalId ?? null,
    concept_id: input.conceptId ?? null,
    scope: input.scope ?? 'user',
    name: input.name,
    description: input.description ?? null,
    trigger: input.trigger,
    procedure: input.procedure,
    source_run_id: input.sourceRunId ?? null,
    source_event_id: null,
    status: 'draft',
    success_count: 0,
    failure_count: 0,
    last_used_at: null,
  };
}