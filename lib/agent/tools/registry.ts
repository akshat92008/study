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
