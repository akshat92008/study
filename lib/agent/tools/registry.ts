import type { AgentToolDefinition } from '@/lib/agent/types';
import { getLearnerContextTool } from '@/lib/agent/tools/learning/getLearnerContext';
import { retrieveSourceChunksTool } from '@/lib/agent/tools/learning/retrieveSourceChunks';
import { extractLearningSignalsTool } from '@/lib/agent/tools/learning/extractLearningSignals';
import { diagnoseWeakAreasTool } from '@/lib/agent/tools/learning/diagnoseWeakAreas';
import { updateMicrotargetTool } from '@/lib/agent/tools/learning/updateMicrotarget';
import { writeLearningEventTool } from '@/lib/agent/tools/learning/writeLearningEvent';
import { applyPracticeAttemptTool } from '@/lib/agent/tools/learning/applyPracticeAttempt';
import { completeSessionTool } from '@/lib/agent/tools/learning/completeSession';
import { adaptDailyPlanTool } from '@/lib/agent/tools/learning/adaptDailyPlan';
import { recordAutopsyMistakeTool } from '@/lib/agent/tools/learning/recordAutopsyMistake';
import { retrieveAgentSkillsTool } from '@/lib/agent/tools/learning/retrieveAgentSkills';
import { readTrajectoryContextTool } from '@/lib/agent/tools/learning/readTrajectoryContext';
import { verifyWeakAreaStateTool } from '@/lib/agent/tools/learning/verifyWeakAreaState';
import { createAgentSkillTool } from '@/lib/agent/tools/learning/createAgentSkill';
import { markSkillUsedTool } from '@/lib/agent/tools/learning/markSkillUsed';
import { proposeNextActionTool } from '@/lib/agent/tools/learning/proposeNextAction';

const tools: AgentToolDefinition[] = [
  getLearnerContextTool,
  retrieveSourceChunksTool,
  extractLearningSignalsTool,
  diagnoseWeakAreasTool,
  updateMicrotargetTool,
  writeLearningEventTool,
  applyPracticeAttemptTool,
  completeSessionTool,
  adaptDailyPlanTool,
  recordAutopsyMistakeTool,
  retrieveAgentSkillsTool,
  readTrajectoryContextTool,
  verifyWeakAreaStateTool,
  createAgentSkillTool,
  markSkillUsedTool,
  proposeNextActionTool,
] as unknown as AgentToolDefinition[];

export const TOOL_DELIVERY_STATUS = {
  get_learner_context: { status: 'active', reason: 'User-scoped learner context read.' },
  retrieve_source_chunks: { status: 'active', reason: 'User-scoped source retrieval.' },
  extract_learning_signals: { status: 'active', reason: 'Schema-validated signal extraction.' },
  diagnose_weak_areas: { status: 'active', reason: 'Read-only diagnosis.' },
  upsert_atlas_concept: { status: 'compatibility_disabled', reason: 'Concept resolution is owned by the canonical projector.' },
  update_concept_mastery: { status: 'compatibility_disabled', reason: 'Mastery writes are owned by write_learning_event and apply_core_loop_projection.' },
  create_memory_card: { status: 'compatibility_disabled', reason: 'Revision cards are created atomically by apply_core_loop_projection.' },
  update_microtarget: { status: 'active', reason: 'Derived mission work after core projection.' },
  write_learning_event: { status: 'active', reason: 'Canonical learner-state projection entry point.' },
  apply_practice_attempt: { status: 'active', reason: 'Canonical projection for saved practice attempts.' },
  complete_session: { status: 'active', reason: 'Canonical verified session completion.' },
  adapt_daily_plan: { status: 'active', reason: 'Idempotent user-scoped derived planning.' },
  record_autopsy_mistake: { status: 'active', reason: 'Canonical autopsy projection.' },
  retrieve_agent_skills: { status: 'active', reason: 'User-scoped skill retrieval.' },
  read_trajectory_context: { status: 'active', reason: 'User-scoped trace retrieval.' },
  verify_weak_area_state: { status: 'active', reason: 'Post-mutation verification.' },
  create_agent_skill: { status: 'active', reason: 'Guarded draft-only skill creation.' },
  mark_skill_used: { status: 'active', reason: 'Owned skill usage tracking.' },
  propose_next_action: { status: 'active', reason: 'Persistent next-action proposal.' },
} as const;

export const learningToolRegistry = new Map<string, AgentToolDefinition>(
  tools.map((tool) => [tool.name, tool])
);

export function getLearningTool(name: string) {
  return learningToolRegistry.get(name) ?? null;
}

export function listLearningTools() {
  return [...learningToolRegistry.values()];
}
