import type { AgentToolDefinition, JsonObject } from '@/lib/agent/types';

export class ToolLoopGuard {
  private totalCalls = 0;
  private callsByName = new Map<string, number>();

  constructor(private readonly maxCallsPerTurn: number) {}

  assertCanCall(tool: AgentToolDefinition, input: JsonObject) {
    this.totalCalls += 1;
    if (this.totalCalls > this.maxCallsPerTurn) {
      throw new Error(`Tool loop guard blocked ${tool.name}: max ${this.maxCallsPerTurn} calls per turn exceeded.`);
    }

    const count = (this.callsByName.get(tool.name) ?? 0) + 1;
    this.callsByName.set(tool.name, count);
    if (count > tool.maxCallsPerTurn) {
      throw new Error(`Tool loop guard blocked ${tool.name}: max ${tool.maxCallsPerTurn} calls for this tool exceeded.`);
    }

    if (!tool.idempotent && count > 1) {
      throw new Error(`Tool loop guard blocked repeated non-idempotent call to ${tool.name}.`);
    }

    void input;
  }
}

