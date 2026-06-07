import { randomUUID } from 'node:crypto';
import type { AgentToolContext, AgentToolResult, JsonObject, ToolCallRecord, ToolResultRecord } from '@/lib/agent/types';
import { getLearningTool } from '@/lib/agent/tools/registry';
import { ToolLoopGuard } from '@/lib/agent/guardrails/toolLoopGuard';

export interface ToolExecutionState {
  guard: ToolLoopGuard;
  calls: ToolCallRecord[];
  results: ToolResultRecord[];
}

export function createToolExecutionState(maxCallsPerTurn: number): ToolExecutionState {
  return {
    guard: new ToolLoopGuard(maxCallsPerTurn),
    calls: [],
    results: [],
  };
}

function errorResult(message: string, code = 'tool_execution_failed'): AgentToolResult {
  return {
    success: false,
    changed: false,
    summary: message,
    error: { code, message },
  };
}

export async function executeLearningTool(
  name: string,
  rawInput: JsonObject,
  context: AgentToolContext,
  state: ToolExecutionState
): Promise<ToolResultRecord> {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  const call: ToolCallRecord = { id, name, input: rawInput, startedAt };
  state.calls.push(call);

  let result: AgentToolResult;
  try {
    const tool = getLearningTool(name);
    if (!tool) throw new Error(`Unknown tool: ${name}`);
    if (tool.requiresAuth && !context.userId) throw new Error(`${name} requires an authenticated user.`);
    state.guard.assertCanCall(tool, rawInput);
    const input = tool.inputSchema.parse(rawInput);
    const output = await tool.handler(input, context);
    result = tool.outputSchema.parse(output) as AgentToolResult;
  } catch (error) {
    result = errorResult(error instanceof Error ? error.message : String(error));
  }

  const completedAt = new Date().toISOString();
  call.completedAt = completedAt;
  const record: ToolResultRecord = {
    ...result,
    id,
    toolName: name,
    startedAt,
    completedAt,
  };
  state.results.push(record);
  return record;
}

