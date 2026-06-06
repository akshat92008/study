import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/lib/utils/logger';
import type { AmauraAgentName, AmauraBudgetContext, AmauraBudgetPolicy } from './types';

type SupabaseLike = ReturnType<typeof createAdminClient>;

export type AgentBudgetLimits = {
  perUserDaily: number;
  perUserMonthly: number;
  globalDaily: number;
};

export function getAgentBudgetLimits(): AgentBudgetLimits {
  return {
    perUserDaily: boundedInt(process.env.MAX_AGENT_AI_CALLS_PER_USER_PER_DAY, 3, 0, 100),
    perUserMonthly: boundedInt(process.env.MAX_AGENT_AI_CALLS_PER_USER_PER_MONTH, 50, 0, 5_000),
    globalDaily: boundedInt(process.env.MAX_AGENT_AI_CALLS_GLOBAL_PER_DAY, 500, 0, 100_000),
  };
}

export function agentRuntimeEnabled() {
  return envBool('ENABLE_AMAURA_AGENTS', envBool('ENABLE_AGENT_RUNTIME', true));
}

export function agentBackgroundJobsEnabled() {
  return envBool('ENABLE_AGENT_BACKGROUND_JOBS', true);
}

export function agentLlmCallsEnabled() {
  return envBool('ENABLE_AGENT_LLM_CALLS', false);
}

export function agentBackgroundModel() {
  return (process.env.AGENT_BACKGROUND_MODEL || 'gemini-flash').trim().toLowerCase();
}

export class BudgetAgent {
  constructor(
    private readonly input: {
      userId: string;
      agentName: AmauraAgentName;
      policy: AmauraBudgetPolicy;
      client?: SupabaseLike;
    }
  ) {}

  createContext(): AmauraBudgetContext {
    let aiCallsUsed = 0;
    return {
      maxAiCalls: this.input.policy.maxAiCalls,
      get aiCallsUsed() {
        return aiCallsUsed;
      },
      canUseAi: async () => {
        if (aiCallsUsed >= this.input.policy.maxAiCalls) return false;
        return this.canUseAi();
      },
      recordAiCall: async () => {
        if (aiCallsUsed >= this.input.policy.maxAiCalls) return false;
        const allowed = await this.canUseAi();
        if (!allowed) return false;
        aiCallsUsed += 1;
        return true;
      },
    };
  }

  async canUseAi(): Promise<boolean> {
    if (this.input.policy.maxAiCalls <= 0) return false;
    if (this.input.policy.model !== 'gemini-flash') return false;
    if (agentBackgroundModel() !== 'gemini-flash') return false;
    if (!agentLlmCallsEnabled()) return false;

    const limits = getAgentBudgetLimits();
    if (limits.perUserDaily <= 0 || limits.perUserMonthly <= 0 || limits.globalDaily <= 0) {
      return false;
    }

    const supabase = this.input.client ?? createAdminClient();
    const dayStart = startOfUtcDay(new Date()).toISOString();
    const monthStart = startOfUtcMonth(new Date()).toISOString();

    const [userDay, userMonth, globalDay] = await Promise.all([
      supabase
        .from('ai_usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', this.input.userId)
        .eq('feature', 'amaura_agent')
        .gte('created_at', dayStart),
      supabase
        .from('ai_usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', this.input.userId)
        .eq('feature', 'amaura_agent')
        .gte('created_at', monthStart),
      supabase
        .from('ai_usage_events')
        .select('id', { count: 'exact', head: true })
        .eq('feature', 'amaura_agent')
        .gte('created_at', dayStart),
    ]);

    const errors = [userDay.error, userMonth.error, globalDay.error].filter(Boolean);
    if (errors.length > 0) {
      logger.warn('BudgetAgent failed closed for agent AI use', {
        userId: this.input.userId,
        agentName: this.input.agentName,
        errors: errors.map((error: any) => error.message),
      });
      return false;
    }

    return (
      (userDay.count ?? 0) < limits.perUserDaily &&
      (userMonth.count ?? 0) < limits.perUserMonthly &&
      (globalDay.count ?? 0) < limits.globalDaily
    );
  }
}

function startOfUtcDay(value: Date) {
  const date = new Date(value);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function startOfUtcMonth(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function boundedInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function envBool(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}
