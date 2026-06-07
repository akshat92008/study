/**
 * Tool result wrappers for consistent return types across tool execution.
 * All tools should return ToolResultRecord which includes these fields.
 */
import type { JsonObject } from '@/lib/agent/types';

// Well-known tool result types used throughout the runtime
export interface DurableToolCallInput {
  toolName: string;
  args: JsonObject;
  runId: string;
  stepId?: string;
  userId: string;
  idempotencyKey: string;
}

export interface ToolCallStartedRecord {
  id: string;
  runId: string;
  stepId?: string;
  userId: string;
  toolName: string;
  toolset?: string;
  args: JsonObject;
  status: 'started';
  mutating: boolean;
  idempotent: boolean;
  riskLevel: string;
  startedAt: string;
}

export interface ToolCallCompletedRecord {
  id: string;
  result: JsonObject;
  status: 'success' | 'failed' | 'blocked';
  changed: boolean;
  entityType?: string;
  entityIds?: string[];
  durationMs: number;
  completedAt: string;
  error?: {
    code: string;
    message: string;
    details?: JsonObject;
  };
}

export interface ToolResultWithVerification {
  toolResult: JsonObject;
  verification?: {
    entityType: string;
    entityId: string;
    expected: JsonObject;
    actual: JsonObject;
    success: boolean;
    summary: string;
  };
}

/**
 * Summarize a tool result for logging/tracing
 */
export function summarizeToolResult(result: JsonObject): string {
  const success = result.success as boolean;
  const changed = result.changed as boolean;
  const summary = result.summary as string;
  return `${result.toolName ?? 'unknown'}: ${success ? 'OK' : 'FAIL'}${changed ? ' (changed)' : ''} - ${summary}`;
}

/**
 * Build a summary of tool calls for a run (useful for final response)
 */
export function summarizeToolCalls(calls: JsonObject[]): {
  total: number;
  successful: number;
  failed: number;
  mutating: Array<{ tool: string; changed: boolean; summary: string }>;
} {
  const total = calls.length;
  let successful = 0;
  let failed = 0;
  const mutating: Array<{ tool: string; changed: boolean; summary: string }> = [];

  for (const call of calls) {
    const success = call.success as boolean;
    const changed = call.changed as boolean;
    if (success) successful++;
    else failed++;
    if (changed && call.toolName) {
      mutating.push({ tool: call.toolName as string, changed: true, summary: call.summary as string });
    }
  }

  return { total, successful, failed, mutating };
}