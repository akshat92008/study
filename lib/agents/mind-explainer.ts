import { createAdminClient } from '@/lib/supabase/admin';
import { budgetedGenerateText } from '@/lib/ai/budgeted';
import { isAiEscalationEnabled } from './policy';

type ExplainOptions = {
  userId: string;
  deep?: boolean;
  limit?: number;
};

export async function explainRecentAgentChanges(options: ExplainOptions) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('agent_actions')
    .select('agent_name, action_type, status, reason, evidence, created_at')
    .eq('user_id', options.userId)
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(options.limit ?? 10, 25)));

  const deterministic = deterministicAgentExplanation(data ?? []);
  if (!options.deep || !isAiEscalationEnabled() || !deterministic.actions.length) {
    return deterministic.text;
  }

  try {
    return await budgetedGenerateText({
      userId: options.userId,
      feature: 'chat',
      route: 'mind:agent-change-explainer',
      model: 'flash',
      systemPrompt: 'Explain learner-model changes clearly and briefly. Do not invent changes not listed.',
      userPrompt: deterministic.text,
      maxOutputTokens: 260,
      metadata: { agent: 'MIND' },
    });
  } catch {
    return deterministic.text;
  }
}

export function deterministicAgentExplanation(actions: any[]) {
  if (!actions.length) {
    return {
      actions: [],
      text: 'Cognition has not made recent learning-model changes yet.',
    };
  }

  const lines = actions.slice(0, 8).map((action) => {
    const agent = String(action.agent_name ?? 'system').toUpperCase();
    const status = action.status === 'proposed' || action.approval_status === 'pending'
      ? 'needs approval'
      : action.status;
    const reason = action.reason ? ` because ${String(action.reason).replace(/\.$/, '')}` : '';
    return `- ${agent} ${humanizeAction(action.action_type)} (${status})${reason}.`;
  });

  const proposedCount = actions.filter((action) =>
    action.status === 'proposed' || action.approval_status === 'pending'
  ).length;
  if (proposedCount > 0) {
    lines.push(`- ${proposedCount} change${proposedCount === 1 ? '' : 's'} need your approval.`);
  }

  return {
    actions,
    text: ['Cognition updated your learning model:', ...lines].join('\n'),
  };
}

function humanizeAction(actionType: string) {
  return String(actionType)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
