import { execSync } from 'child_process';
import { rmSync } from 'fs';

function runCommand(command) {
  return execSync(command, { stdio: 'pipe' }).toString();
}

const start = Date.now();
rmSync('.next/types', { recursive: true, force: true });
// Run the local TypeScript binary through pnpm; no network access required.
runCommand('pnpm exec tsc --noEmit');
const durationSec = (Date.now() - start) / 1000;
console.log(`TypeScript type-check completed in ${durationSec.toFixed(2)} seconds`);
if (durationSec > 90) {
  console.error('❌ Type-check exceeded 90 seconds limit');
  process.exit(1);
} else {
  console.log('✅ Type-check within acceptable time');
  process.exit(0);
}
