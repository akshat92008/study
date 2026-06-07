import type { AgentToolDefinition } from '@/lib/agent/types';
import { getLearnerContextTool } from '@/lib/agent/tools/learning/getLearnerContext';
import { retrieveSourceChunksTool } from '@/lib/agent/tools/learning/retrieveSourceChunks';
import { extractLearningSignalsTool } from '@/lib/agent/tools/learning/extractLearningSignals';
import { diagnoseWeakAreasTool } from '@/lib/agent/tools/learning/diagnoseWeakAreas';
import { upsertAtlasConceptTool } from '@/lib/agent/tools/learning/upsertAtlasConcept';
import { updateConceptMasteryTool } from '@/lib/agent/tools/learning/updateConceptMastery';
import { createMemoryCardTool } from '@/lib/agent/tools/learning/createMemoryCard';
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
  upsertAtlasConceptTool,
  updateConceptMasteryTool,
  createMemoryCardTool,
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

export const learningToolRegistry = new Map<string, AgentToolDefinition>(
  tools.map((tool) => [tool.name, tool])
);

export function getLearningTool(name: string) {
  return learningToolRegistry.get(name) ?? null;
}

export function listLearningTools() {
  return [...learningToolRegistry.values()];
}
