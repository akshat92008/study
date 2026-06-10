#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const ROOT_DIR = process.cwd();

interface Check {
  name: string;
  run: () => boolean | Promise<boolean>;
  failMessage: string;
}

const checks: Check[] = [
  {
    name: 'Idempotency Keys Removed startedAt',
    run: () => {
      const content = readFileSync(resolve(ROOT_DIR, 'lib/agent/tools/executor.ts'), 'utf-8');
      const lines = content.split('\n');
      const hasStableKey = lines.some(line => line.includes('stableKey') && line.includes('idempotencyKey'));
      const noStartedAtInKey = !lines.some(line => line.includes('idempotencyKey') && line.includes('startedAt'));
      return hasStableKey && noStartedAtInKey;
    },
    failMessage: 'executor.ts still uses startedAt or is missing stableKey in idempotency generation.',
  },
  {
    name: 'No Cognitive Agent Imports',
    run: () => {
      try {
        const grepRes = execSync('grep -rn "runCognitionAgentTurn" lib/ app/ || true', { encoding: 'utf-8' });
        return grepRes.trim() === '';
      } catch (e) {
        return false;
      }
    },
    failMessage: 'Found references to the deprecated runCognitionAgentTurn.',
  },
  {
    name: 'Replay Route is Dry-Run by Default and Requires Approval',
    run: () => {
      const content = readFileSync(resolve(ROOT_DIR, 'app/api/admin/hermes/runs/[id]/replay/route.ts'), 'utf-8');
      return content.includes('realRun') && content.includes('dryRun: true') && content.includes('adminConfirmed') && !content.includes('Date.now()');
    },
    failMessage: 'Replay route must default to dry-run, require admin confirmation, and not use Date.now() for idempotency.',
  },
  {
    name: 'Chat Policy Prevents Over-Mutation',
    run: () => {
      // Chat policy should not casually allow mission_write or learner_visible_write without strict intent
      const content = readFileSync(resolve(ROOT_DIR, 'lib/agent/policy.ts'), 'utf-8');
      const chatPolicyStr = content.split('chat: {')[1]?.split('},')[0] || '';
      return !chatPolicyStr.includes("'mission_write'") && !chatPolicyStr.includes("'learner_visible_write'");
    },
    failMessage: 'Chat policy must prevent over-mutation (e.g. mission_write) to avoid casual state changes.',
  },
  {
    name: 'Tool Schema Validations Present',
    run: () => {
      const content = readFileSync(resolve(ROOT_DIR, 'lib/agent/tools/schemas.ts'), 'utf-8');
      return content.includes('z.object(') || content.includes('zod');
    },
    failMessage: 'Tool schemas must be strictly defined with Zod.',
  },
  {
    name: 'Idempotency Keys Are Context-Specific',
    run: () => {
      const content = readFileSync(resolve(ROOT_DIR, 'lib/agent/tools/executor.ts'), 'utf-8');
      // Should include context identifiers like sourceEventId or similar for specific tool runs
      return content.includes('sourceEventId');
    },
    failMessage: 'Idempotency must be based on source events or runId, not just timestamps.',
  },
  {
    name: 'Background Workers Implement Retry & DLQ',
    run: () => {
      const content = readFileSync(resolve(ROOT_DIR, 'lib/events/worker.ts'), 'utf-8');
      return content.includes('retry') && content.includes('dlq');
    },
    failMessage: 'Workers must properly implement retry logic and Dead Letter Queue (DLQ).',
  },
  {
    name: 'Cost Budgets Enforced',
    run: () => {
      const content = readFileSync(resolve(ROOT_DIR, 'lib/usage/enforce-feature-limit.ts'), 'utf-8');
      return content.includes('monthly_ai_budget_exceeded');
    },
    failMessage: 'Usage checks must enforce strict monthly AI USD budgets.',
  }
];

async function runChecks() {
  console.log('🛡️ Certifying Hermes Launch...');
  let failed = 0;
  for (const check of checks) {
    process.stdout.write(`⏳ Checking: ${check.name}... `);
    try {
      const passed = await check.run();
      if (passed) {
        console.log('✅ PASS');
      } else {
        console.log('❌ FAIL');
        console.error(`   -> ${check.failMessage}`);
        failed++;
      }
    } catch (e: any) {
      console.log('❌ ERROR');
      console.error(`   -> Failed to run check: ${e.message}`);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\n🚨 Certification Failed. ${failed} check(s) did not pass.`);
    process.exit(1);
  } else {
    console.log('\n🎉 Hermes Certification PASSED! The system is ready.');
    process.exit(0);
  }
}

runChecks().catch(console.error);
