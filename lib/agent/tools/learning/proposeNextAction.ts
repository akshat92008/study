/**
 * proposeNextAction tool - propose and persist the next learning action.
 * Used when the agent recommends a specific action for the learner.
 */
import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema } from '@/lib/agent/tools/schemas';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const ProposeNextActionInputSchema = z.object({
  actionType: z.enum(['review', 'practice', 'source_read', 'mistake_review', 'mind_chat', 'session', 'autopsy']),
  label: z.string().min(3).max(100),
  rationale: z.string().max(500),
  estimatedMinutes: z.number().int().min(1).max(120).default(15),
  conceptName: z.string().nullable().optional(),
  conceptId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  sourceRunId: z.string().uuid().nullable().optional(),
  priority: z.enum(['high', 'medium', 'low']).default('medium'),
});

export type ProposeNextActionInput = z.infer<typeof ProposeNextActionInputSchema>;

import { isPlaceholderTitle } from '@/lib/topic-seeding/templates/neet/topic-skeleton';

export const proposeNextActionTool: AgentToolDefinition<typeof ProposeNextActionInputSchema, typeof ToolResultSchema> = {
  name: 'propose_next_action',
  description: 'Propose and persist a next learning action recommendation. If persistent action is needed, write to agent_actions or similar table.',
  inputSchema: ProposeNextActionInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 3,
  requiresAuth: true,
  async handler(input, context) {
    if (input.conceptName && isPlaceholderTitle(input.conceptName)) {
      return {
        success: false,
        changed: false,
        summary: 'Ignored placeholder concept. Agents should not recommend placeholder topics.',
        data: { proposed: null },
      };
    }

    const goalId = input.goalId ?? context.goalId;

    // Write to agent_actions as the persistent next-action record
    const actionInsert: Record<string, unknown> = {
      user_id: context.userId,
      run_id: context.runId ?? null,
      agent_name: 'planner',
      action_type: `next_action:${input.actionType}`,
      target_type: input.conceptId ? 'concept' : 'mission',
      target_id: input.conceptId ?? null,
      status: 'proposed',
      risk_level: 'auto_with_undo',
      approval_status: 'not_required',
      confidence: input.priority === 'high' ? 0.9 : input.priority === 'medium' ? 0.7 : 0.5,
      evidence: {
        actionType: input.actionType,
        label: input.label,
        rationale: input.rationale,
        estimatedMinutes: input.estimatedMinutes,
        concept: input.conceptName,
      },
      reason: input.rationale,
      before_state: {},
      after_state: {
        actionType: input.actionType,
        label: input.label,
        createdBy: 'cognition_runtime',
        createdAt: context.now.toISOString(),
      },
      idempotency_key: `next-action:${context.userId}:${goalId ?? 'global'}:${context.now.toISOString().slice(0, 10)}`,
      created_at: context.now.toISOString(),
      updated_at: context.now.toISOString(),
    };

    const { data: action, error: actionError } = await context.supabase
      .from('agent_actions')
      .insert(actionInsert)
      .select('id, action_type, status, evidence, reason')
      .single();

    if (actionError) {
      logger.warn('propose_next_action failed to write agent_action', {
        userId: context.userId,
        error: actionError.message,
      });
      // Don't fail the tool - just return the proposed action without persisting
      return {
        success: true,
        changed: false,
        summary: `Next action proposed but not persisted: ${actionError.message}`,
        data: {
          proposed: {
            actionType: input.actionType,
            label: input.label,
            rationale: input.rationale,
            estimatedMinutes: input.estimatedMinutes,
            persisted: false,
          },
        },
      };
    }

    return {
      success: true,
      changed: true,
      entityType: 'agent_action',
      entityIds: [action.id],
      summary: `Next action '${input.label}' proposed (${input.actionType}, ~${input.estimatedMinutes}min).`,
      data: {
        proposed: {
          actionType: input.actionType,
          label: input.label,
          rationale: input.rationale,
          estimatedMinutes: input.estimatedMinutes,
          persisted: true,
          actionId: action.id,
        },
      },
    };
  },
};