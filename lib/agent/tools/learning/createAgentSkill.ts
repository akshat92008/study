/**
 * createAgentSkill tool - persist a durable skill from a repeated pattern.
 * Skills are only created after stable patterns are detected, not from one event.
 */
import type { AgentToolDefinition } from '@/lib/agent/types';
import { ToolResultSchema } from '@/lib/agent/tools/schemas';
import { logger } from '@/lib/utils/logger';
import { z } from 'zod';

const CreateAgentSkillInputSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
  trigger: z.object({
    conceptName: z.string().optional(),
    signalTypes: z.array(z.string()).optional(),
    repeatedCount: z.number().default(3),
  }),
  procedure: z.string().min(20),
  scope: z.enum(['global', 'user', 'goal', 'concept']).default('user'),
  conceptId: z.string().uuid().nullable().optional(),
  goalId: z.string().uuid().nullable().optional(),
  sourceRunId: z.string().uuid().nullable().optional(),
});

export type CreateAgentSkillInput = z.infer<typeof CreateAgentSkillInputSchema>;

export const createAgentSkillTool: AgentToolDefinition<typeof CreateAgentSkillInputSchema, typeof ToolResultSchema> = {
  name: 'create_agent_skill',
  description: 'Create a durable agent skill when a repeated repair pattern is detected. Skills should only be created after stable patterns, not from single events.',
  inputSchema: CreateAgentSkillInputSchema,
  outputSchema: ToolResultSchema,
  mutating: true,
  idempotent: true,
  maxCallsPerTurn: 4,
  requiresAuth: true,
  async handler(input, context) {
    // Guard: do not create skills from a single event
    const repeatedCount = input.trigger?.repeatedCount ?? 0;
    if (repeatedCount < 3) {
      return {
        success: true,
        changed: false,
        summary: `Skill creation deferred: need 3+ repeated patterns, got ${repeatedCount}.`,
        data: { created: false, reason: 'not_enough_repetitions' },
      };
    }

    const insert: Record<string, unknown> = {
      user_id: context.userId,
      name: input.name,
      description: input.description ?? null,
      trigger: {
        ...input.trigger,
        conceptName: input.trigger?.conceptName ?? null,
      },
      procedure: input.procedure,
      scope: input.scope,
      concept_id: input.conceptId ?? null,
      goal_id: input.goalId ?? context.goalId ?? null,
      source_run_id: input.sourceRunId ?? context.runId ?? null,
      status: 'draft', // New skills start as draft
      created_at: context.now.toISOString(),
      updated_at: context.now.toISOString(),
    };

    const { data, error } = await context.supabase
      .from('agent_skills')
      .insert(insert)
      .select('id, name, scope, status')
      .single();

    if (error) {
      logger.warn('create_agent_skill failed', { userId: context.userId, name: input.name, error: error.message });
      return {
        success: false,
        changed: false,
        summary: `Skill creation failed: ${error.message}`,
        error: { code: 'SKILL_CREATION_FAILED', message: error.message },
      };
    }

    return {
      success: true,
      changed: true,
      entityType: 'agent_skill',
      entityIds: [data.id],
      summary: `Skill '${input.name}' created as draft. Activate after verification.`,
      data: { created: true, skill: data },
    };
  },
};