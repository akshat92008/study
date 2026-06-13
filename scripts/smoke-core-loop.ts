import { spawnSync } from 'node:child_process';

const envReady = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const steps = [
  { name: 'static_core_loop_contracts', command: ['npm', ['run', 'verify:core-loop-contracts']] },
  { name: 'core_loop_invariants', command: ['npm', ['run', 'test:invariants']] },
  { name: 'mind_agent_evals', command: ['npm', ['run', 'eval:mind']] },
  { name: 'mvp_contract_loop', command: ['npx', ['vitest', 'run', 'tests/integration/mvpLocalLoop.test.ts', 'tests/integration/coreLoop.test.ts']] },
];

const results = steps.map((step) => {
  const result = spawnSync(step.command[0], step.command[1], { encoding: 'utf8', env: process.env });
  return {
    step: step.name,
    passed: result.status === 0,
    exitCode: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(-2500),
  };
});

const passed = results.every((result) => result.passed);
console.log(JSON.stringify({
  ok: passed,
  mode: envReady ? 'database-capable-contract-smoke' : 'deterministic-local-contract-smoke',
  note: envReady
    ? 'Environment is available; deterministic integration contracts ran.'
    : 'Live user creation was skipped because Supabase service credentials are unavailable.',
  results,
}, null, 2));
if (!passed) process.exit(1);
