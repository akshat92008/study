import type { AgentChannel } from './types';

/**
 * IterationBudget - tracks remaining iterations for the agent loop.
 * Default limits per channel:
 *   chat: 5 iterations
 *   practice: 5 iterations
 *   autopsy: 6 iterations
 *   session: 4 iterations
 *   background: 4 iterations
 */
export class IterationBudget {
  private _usedIterations: number = 0;
  private _maxIterations: number;
  private _channel: AgentChannel;

  constructor(channel: AgentChannel, maxIterations?: number) {
    this._channel = channel;
    this._maxIterations = maxIterations ?? IterationBudget.defaultForChannel(channel);
  }

  static defaultForChannel(channel: AgentChannel): number {
    switch (channel) {
      case 'chat': return 5;
      case 'practice': return 5;
      case 'autopsy': return 6;
      case 'session': return 4;
      case 'background': return 4;
      case 'revision': return 5;
      default: return 5;
    }
  }

  get used(): number { return this._usedIterations; }
  get max(): number { return this._maxIterations; }
  get remaining(): number { return Math.max(0, this._maxIterations - this._usedIterations); }
  get exhausted(): boolean { return this.remaining <= 0; }

  canContinue(): boolean {
    return this.remaining > 0;
  }

  recordIteration(): void {
    this._usedIterations++;
  }

  reset(maxIterations?: number): void {
    this._usedIterations = 0;
    if (maxIterations !== undefined) this._maxIterations = maxIterations;
  }

  toJSON() {
    return {
      channel: this._channel,
      used: this._usedIterations,
      max: this._maxIterations,
      remaining: this.remaining,
      exhausted: this.exhausted,
    };
  }
}

/**
 * ToolCallBudget - tracks tool calls within an agent loop.
 * Per-channel defaults:
 *   chat: 8 tool calls
 *   practice: 10 tool calls
 *   autopsy: 12 tool calls
 *   session: 8 tool calls
 *   background: 8 tool calls
 */
export class ToolCallBudget {
  private _usedCalls: number = 0;
  private _maxCalls: number;
  private _perToolCount: Map<string, number> = new Map();
  private _maxPerTool: number = 4; // Prevent spamming same tool
  private _channel: AgentChannel;

  constructor(channel: AgentChannel, maxCalls?: number) {
    this._channel = channel;
    this._maxCalls = maxCalls ?? ToolCallBudget.defaultForChannel(channel);
  }

  static defaultForChannel(channel: AgentChannel): number {
    switch (channel) {
      case 'chat': return 8;
      case 'practice': return 10;
      case 'autopsy': return 12;
      case 'session': return 8;
      case 'background': return 8;
      case 'revision': return 8;
      default: return 8;
    }
  }

  get used(): number { return this._usedCalls; }
  get max(): number { return this._maxCalls; }
  get remaining(): number { return Math.max(0, this._maxCalls - this._usedCalls); }
  get exhausted(): boolean { return this.remaining <= 0; }

  /**
   * Check if a specific tool can be called (within total budget and per-tool limit)
   */
  canCallTool(toolName: string): boolean {
    if (this.exhausted) return false;
    const perToolUsed = this._perToolCount.get(toolName) ?? 0;
    return perToolUsed < this._maxPerTool;
  }

  /**
   * Record a tool call, incrementing both total and per-tool counters
   */
  recordCall(toolName: string): void {
    this._usedCalls++;
    const current = this._perToolCount.get(toolName) ?? 0;
    this._perToolCount.set(toolName, current + 1);
  }

  /**
   * Get count of calls made for a specific tool
   */
  toolCallCount(toolName: string): number {
    return this._perToolCount.get(toolName) ?? 0;
  }

  /**
   * Check remaining budget with remaining iterations consideration
   */
  canContinue(iterationsUsed: number, maxIterations: number): boolean {
    if (this.exhausted) return false;
    // If we have fewer remaining iterations than remaining tool calls,
    // we can't make more tool calls than we have iterations left
    const iterationsRemaining = maxIterations - iterationsUsed;
    return this.remaining > 0 && iterationsRemaining > 0;
  }

  reset(maxCalls?: number): void {
    this._usedCalls = 0;
    this._perToolCount.clear();
    if (maxCalls !== undefined) this._maxCalls = maxCalls;
  }

  toJSON() {
    return {
      channel: this._channel,
      used: this._usedCalls,
      max: this._maxCalls,
      remaining: this.remaining,
      exhausted: this.exhausted,
      perTool: Object.fromEntries(this._perToolCount),
    };
  }
}

/**
 * AgentBudget - combined iteration and tool call budgets
 */
export interface AgentBudget {
  iterations: IterationBudget;
  toolCalls: ToolCallBudget;
}

export function createAgentBudget(channel: AgentChannel, maxIterations?: number, maxToolCalls?: number): AgentBudget {
  return {
    iterations: new IterationBudget(channel, maxIterations),
    toolCalls: new ToolCallBudget(channel, maxToolCalls),
  };
}