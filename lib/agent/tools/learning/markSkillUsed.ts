/**
 * markSkillUsed tool - record skill usage and update success/failure counts.
 */
import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema } from '@/lib/agent/tools/schemas';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const MarkSkillUsedInputSchema = z.object({
  skillId: z.string().uuid(),
  outcome: z.enum(['success', 'failure', 'partial']),
  learnerFeedback: z.string().optional(),
});

export type MarkSkillUsedInput = z.infer<typeof MarkSkillUsedInputSchema>;

export const markSkillUsedTool: AgentToolDefinition<typeof MarkSkillUsedInputSchema, typeof ToolResultSchema> = {
  name: 'mark_skill_used',
  description: 'Record that a skill was used during agent execution and update success/failure tracking.',
  inputSchema: MarkSkillUsedInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 8,
  requiresAuth: true,
  async handler(input, context) {
    const { skillId, outcome, learnerFeedback } = input;

    // First, get the current skill
    const { data: skill, error: fetchError } = await context.supabase
      .from('agent_skills')
      .select('id, name, success_count, failure_count, status')
      .eq('id', skillId)
      .eq('user_id', context.userId)
      .maybeSingle();

    if (fetchError || !skill) {
      return {
        success: false,
        changed: false,
        summary: `Skill not found: ${skillId}`,
        error: { code: 'SKILL_NOT_FOUND', message: `Skill ${skillId} not found or not owned by user` },
      };
    }

    // Update counts based on outcome
    const updateField = outcome === 'success'
      ? { success_count: (skill.success_count ?? 0) + 1 }
      : outcome === 'failure'
        ? { failure_count: (skill.failure_count ?? 0) + 1 }
        : {
            success_count: Math.ceil((skill.success_count ?? 0) + 0.5),
            failure_count: Math.ceil((skill.failure_count ?? 0) + 0.5),
          };

    const { data: updated, error: updateError } = await context.supabase
      .from('agent_skills')
      .update({
        ...updateField,
        last_used_at: context.now.toISOString(),
        updated_at: context.now.toISOString(),
        // Auto-disable if failure rate is too high
        ...(skill.failure_count >= 10 &&
          (skill.failure_count / (skill.success_count + skill.failure_count)) > 0.7
          ? { status: 'disabled' }
          : {}),
      })
      .eq('id', skillId)
      .eq('user_id', context.userId)
      .select('id, name, success_count, failure_count, status')
      .single();

    if (updateError) {
      logger.warn('mark_skill_used update failed', { skillId, error: updateError.message });
      return {
        success: false,
        changed: false,
        summary: `Skill usage update failed: ${updateError.message}`,
        error: { code: 'SKILL_UPDATE_FAILED', message: updateError.message },
      };
    }

    return {
      success: true,
      changed: true,
      entityType: 'agent_skill',
      entityIds: [skillId],
      summary: `Skill '${skill.name}' marked as ${outcome}. Success: ${updated?.success_count}, Failure: ${updated?.failure_count}`,
      data: { skill: updated, outcome },
    };
  },
};