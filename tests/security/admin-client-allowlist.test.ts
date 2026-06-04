import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();

function walk(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files;
  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }
  return files;
}

const allowedAppApiPrefixes = [
  'app/api/cron/',
  'app/api/admin/',
  'app/api/internal/',
  'app/api/waitlist/',
  'app/api/health/route.ts',
  'app/api/webhooks/stripe/route.ts',
  'app/api/materials/',
];

const allowedRuntimeFiles = new Set([
  'lib/agents/agent-runtime.ts',
  'lib/agents/action-executor.ts',
  'lib/agents/mind-explainer.ts',
  'lib/beta/gate.ts',
  'lib/ai/cost-guard.ts',
  'lib/ai/response-cache.ts',
  'lib/ai/session-summary.ts',
  'lib/events/agents/provider-health.ts',
  'lib/events/orchestrator.ts',
  'lib/events/replay.ts',
  'lib/events/retry.ts',
  'lib/events/worker-route.ts',
  'lib/events/worker.ts',
  'lib/graph/knowledgeGraph.ts',
  'lib/rag/ingest.ts',
  'lib/rag/mind-rag.ts',
  'lib/rag/retrieval.ts',
  'lib/services/ai-usage.service.ts',
  'lib/services/autopsy-jobs.ts',
  'lib/services/chatMemoryService.ts',
  'lib/services/command-plan.service.ts',
  'lib/services/learner-state-version.ts',
  'lib/services/session-card-invalidation.ts',
  'lib/supabase/admin.ts',
  'lib/supabase/adminSafe.ts',
  'lib/utils/billing.ts',
  'lib/engines/cognition-graph.ts',
  'lib/engines/command-engine.ts',
  'lib/engines/concept-expansion-engine.ts',
  'lib/engines/learning-state-engine.ts',
  'lib/engines/mastery-updater.ts',
  'lib/engines/revision-engine.ts',
  'lib/admin/audit.ts'
]);

describe('admin client allowlist', () => {
  it('keeps service-role usage out of user-facing API routes', () => {
    const offenders = walk(path.join(root, 'app/api'))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('createAdminClient'))
      .map((file) => path.relative(root, file))
      .filter((relative) => !allowedAppApiPrefixes.some((prefix) => relative.startsWith(prefix)));

    expect(offenders).toEqual([]);
  });

  it('documents all intentional runtime createAdminClient users', () => {
    const offenders = walk(path.join(root, 'lib'))
      .filter((file) => fs.readFileSync(file, 'utf8').includes('createAdminClient'))
      .map((file) => path.relative(root, file))
      .filter((relative) => !allowedRuntimeFiles.has(relative));

    expect(offenders).toEqual([]);
  });
});
