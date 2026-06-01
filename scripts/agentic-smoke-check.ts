import fs from 'fs';
import path from 'path';

const root = process.cwd();

function read(file: string) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function requireIncludes(file: string, values: string[]) {
  const text = read(file);
  const missing = values.filter((value) => !text.includes(value));
  if (missing.length) {
    throw new Error(`${file} missing: ${missing.join(', ')}`);
  }
}

function main() {
  requireIncludes('supabase/migrations/20260601170000_agentic_cognition_os.sql', [
    'public.agent_runs',
    'public.agent_actions',
    'public.agent_action_approvals',
    'public.agent_state_snapshots',
    'public.mastery_evidence_ledger',
    'public.rag_ingestion_jobs',
    'public.message_citations',
    'public.material_concept_links',
    'MATERIAL_INGESTED',
    'AUTOPSY_MISTAKE_APPROVED',
  ]);

  requireIncludes('lib/agents/agent-runtime.ts', [
    'startAgentRun',
    'completeAgentRun',
    'failAgentRun',
    'recordAgentAction',
    'approveAgentAction',
    'rejectAgentAction',
  ]);
  requireIncludes('lib/agents/state-summary.ts', ['buildAgenticStateSummary']);

  requireIncludes('lib/events/routes.ts', [
    'rag_agent',
    'planner_agent',
    'MATERIAL_UPLOADED',
    'AUTOPSY_MISTAKE_APPROVED',
    'LEARNER_STATE_CHANGED',
  ]);

  requireIncludes('app/api/internal/health/agentic/route.ts', [
    'agentRuns',
    'pendingApprovals',
    'ragJobs',
    'autopsyJobs',
  ]);

  console.log('Agentic smoke check passed.');
}

main();
