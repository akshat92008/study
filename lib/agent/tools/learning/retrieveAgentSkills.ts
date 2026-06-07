/**
 * retrieveAgentSkills tool - retrieve relevant skills for current context.
 * Skills are durable procedural repair patterns.
 */
import { z } from 'zod';
import type { AgentToolDefinition } from '@/lib/agent/types';

const RetrieveInputSchema = z.object({}).strict();
const ToolResultSchema = z.object({
  success: z.boolean(),
  changed: z.boolean(),
  summary: z.string(),
  data: z.record(z.unknown()).optional(),
  entityType: z.string().optional(),
  entityIds: z.array(z.string()).optional(),
}).passthrough();

export const retrieveAgentSkillsTool: AgentToolDefinition<typeof RetrieveInputSchema, typeof ToolResultSchema> = {
  name: 'retrieve_agent_skills',
  description: 'Retrieve relevant agent skills for the current learning context. Skills are procedural repair patterns for repeated issues.',
  inputSchema: RetrieveInputSchema,
  outputSchema: ToolResultSchema,
  mutating: false,
  idempotent: true,
  maxCallsPerTurn: 1,
  requiresAuth: true,
  async handler(input, context) {
    try {
      // Use parallel queries: user's own skills + global skills
      const [{ data: userSkills }, { data: globalSkills }] = await Promise.all([
        context.supabase
          .from('agent_skills')
          .select('*')
          .eq('status', 'active')
          .eq('user_id', context.userId)
          .order('success_count', { ascending: false })
          .limit(6),
        context.supabase
          .from('agent_skills')
          .select('*')
          .eq('status', 'active')
          .eq('scope', 'global')
          .order('success_count', { ascending: false })
          .limit(6),
      ]);

      const goalId = context.goalId;
      const filtered = [...(userSkills ?? []), ...(globalSkills ?? [])]
        .filter((skill: any) => {
          if (skill.scope === 'global') return true;
          if (skill.scope === 'user' && skill.user_id === context.userId) return true;
          if (skill.scope === 'goal' && goalId && skill.goal_id === goalId) return true;
          return false;
        })
        .slice(0, 5);

      return {
        success: true,
        changed: false,
        entityType: 'agent_skill',
        entityIds: filtered.map((s: any) => s.id),
        summary: filtered.length > 0
          ? `Retrieved ${filtered.length} relevant skill(s).`
          : 'No relevant skills found for current context.',
        data: { skills: filtered, count: filtered.length },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return {
        success: true,
        changed: false,
        summary: `Skill retrieval error: ${message}`,
        data: { skills: [], error: message },
      };
    }
  },
};