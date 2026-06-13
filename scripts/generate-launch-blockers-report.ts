import { spawnSync } from 'node:child_process';

const commands = [
  ['typecheck', 'npm', ['run', 'typecheck']],
  ['core_loop_contracts', 'npm', ['run', 'verify:core-loop-contracts']],
  ['invariants', 'npm', ['run', 'test:invariants']],
  ['mind_eval', 'npm', ['run', 'eval:mind']],
  ['security', 'npm', ['run', 'test:security']],
];

const checks = commands.map(([name, command, args]) => {
  const result = spawnSync(command, args as string[], { encoding: 'utf8', env: process.env });
  return {
    name,
    passed: result.status === 0,
    exitCode: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().slice(-4000),
  };
});

const blocked = checks.some((check) => !check.passed);
console.log(JSON.stringify({
  status: blocked ? 'BLOCKED' : 'PRIVATE BETA CANDIDATE',
  generatedAt: new Date().toISOString(),
  checks,
}, null, 2));
if (blocked) process.exit(1);
