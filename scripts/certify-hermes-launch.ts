#!/usr/bin/env bun
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT_DIR = resolve(__dirname, '..');

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
      const hasIdempotencyFix = lines.some(line => line.includes('const idempotencyKey = stableKey') && !line.includes('startedAt'));
      return hasIdempotencyFix;
    },
    failMessage: 'executor.ts still uses startedAt or is missing stableKey in idempotency generation.',
  },
  {
    name: 'Canonical Entry Points Available',
    run: () => {
      const runtimeContent = readFileSync(resolve(ROOT_DIR, 'lib/agent/runtime.ts'), 'utf-8');
      const indexContent = readFileSync(resolve(ROOT_DIR, 'lib/agent/index.ts'), 'utf-8');
      return runtimeContent.includes('export async function runHermesTurn') && 
             runtimeContent.includes('export async function runHermesEvent') &&
             indexContent.includes('export { runHermesTurn, runHermesEvent }');
    },
    failMessage: 'Canonical entry points (runHermesTurn, runHermesEvent) are not defined and exported correctly.',
  },
  {
    name: 'No Cognitive Agent Imports Outside Internal',
    run: () => {
      // Need to find instances of runCognitionAgentTurn that we missed
      try {
        const { execSync } = require('node:child_process');
        const grepRes = execSync('grep -rn "runCognitionAgentTurn" lib/ app/ || true', { encoding: 'utf-8' });
        return grepRes.trim() === '';
      } catch (e) {
        return false;
      }
    },
    failMessage: 'Found references to the deprecated runCognitionAgentTurn.',
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
