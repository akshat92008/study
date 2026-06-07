import type { ToolResultRecord } from '@/lib/agent/types';

export function summarizeTrajectory(input: {
  toolResults: ToolResultRecord[];
  signalCount: number;
  verificationOk: boolean;
}) {
  const failedTools = input.toolResults.filter((result) => !result.success).map((result) => result.toolName);
  const changedTools = input.toolResults.filter((result) => result.changed).map((result) => result.toolName);
  return {
    signalCount: input.signalCount,
    changedTools,
    failedTools,
    verificationOk: input.verificationOk,
  };
}

