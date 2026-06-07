/**
 * readTrajectoryContext tool - load recent trajectory context.
 * Helps the agent understand recent agent activity before planning.
 */
import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema } from '@/lib/agent/tools/schemas';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const ReadTrajectoryContextInputSchema = z.object({
  trajectoryId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(10).default(3),
});

export type ReadTrajectoryContextInput = z.infer<typeof ReadTrajectoryContextInputSchema>;

export const readTrajectoryContextTool: AgentToolDefinition<typeof ReadTrajectoryContextInputSchema, typeof ToolResultSchema> = {
  name: 'read_trajectory_context',
  description: 'Load recent trajectory (agent run) context for current planning. Returns tool calls and results from recent runs.',
  inputSchema: ReadTrajectoryContextInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 2,
  requiresAuth: true,
  async handler(input, context) {
    try {
      const limit = input.limit ?? 3;

      // 1. Load recent agent_runs for this user
      const { data: runs, error: runsError } = await context.supabase
        .from('agent_runs')
        .select('id, agent_name, status, channel, started_at, completed_at, observation, context_summary, plan, mutation_summary, verification')
        .eq('user_id', context.userId)
        .not('status', 'eq', 'running')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (runsError) {
        return {
          success: true,
          changed: false,
          summary: `Trajectory context retrieval failed: ${runsError.message}`,
          data: { runs: [], runsError: runsError.message },
        };
      }

      // 2. If we have runs, load the tool calls for each
      const runIds = (runs ?? []).map((r: any) => r.id).filter(Boolean);
      let toolCalls: any[] = [];

      if (runIds.length > 0) {
        const { data: calls, error: callsError } = await context.supabase
          .from('agent_tool_calls')
          .select('run_id, tool_name, toolset, status, changed, entity_type, result, started_at, completed_at')
          .in('run_id', runIds)
          .order('started_at', { ascending: false })
          .limit(20);

        if (!callsError && calls) {
          toolCalls = calls;
        }
      }

      // 3. Summarize recent state
      const recentToolResults = toolCalls
        .filter((c: any) => c.status === 'success')
        .map((c: any) => `${c.tool_name}: ${c.changed ? 'changed' : 'read'}`)
        .slice(0, 10);

      return {
        success: true,
        changed: false,
        entityType: 'agent_run',
        entityIds: runIds,
        summary: `Loaded ${runIds.length} recent trajectory(ies) with ${toolCalls.length} tool call(s).`,
        data: {
          runs: runs ?? [],
          toolCalls: toolCalls.slice(0, 20),
          recentToolResults,
          summary: recentToolResults.length > 0
            ? `Recent: ${recentToolResults.join(' | ')}`
            : 'No recent tool calls in recent trajectories.',
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('read_trajectory_context threw', { userId: context.userId, error: message });
      return {
        success: true,
        changed: false,
        summary: `Trajectory context retrieval error: ${message}`,
        data: { runs: [], error: message },
      };
    }
  },
};