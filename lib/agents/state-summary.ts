import { getPendingAgentActions, getRecentAgentActivity } from './agent-runtime';

export async function buildAgenticStateSummary(userId: string) {
  const [{ runs, actions }, pending] = await Promise.all([
    getRecentAgentActivity(userId, { limit: 20 }),
    getPendingAgentActions(userId, { limit: 50 }),
  ]);

  const completedRuns = runs.filter((run: any) => run.status === 'completed').length;
  const failedRuns = runs.filter((run: any) => run.status === 'failed').length;
  const newCards = actions.filter((action: any) => action.action_type === 'create_revision_card' && action.status === 'applied').length;
  const masteryChanges = actions.filter((action: any) => /mastery/i.test(action.action_type)).length;
  const newlyIngestedMaterials = actions.filter((action: any) => action.action_type === 'create_rag_ingestion_job' && action.status === 'applied').length;

  return {
    completedRuns,
    failedRuns,
    pendingApprovalCount: pending.length,
    newCards,
    masteryChanges,
    newlyIngestedMaterials,
    changedSessionRecommendations: actions.filter((action: any) =>
      ['create_session_recommendation', 'adjust_next_session', 'large_plan_rewrite'].includes(action.action_type)
    ).length,
    recentFailures: runs
      .filter((run: any) => run.status === 'failed')
      .slice(0, 5)
      .map((run: any) => ({
        agentName: run.agent_name,
        error: run.error,
        createdAt: run.created_at,
      })),
  };
}
