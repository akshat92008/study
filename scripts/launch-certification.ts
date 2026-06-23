import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('Generating Launch Certification Report...');
  const report: any = {
    timestamp: new Date().toISOString(),
    commit: execSync('git rev-parse HEAD').toString().trim(),
    branch: execSync('git rev-parse --abbrev-ref HEAD').toString().trim(),
    envMode: process.env.APP_LAUNCH_MODE || 'unknown',
    nodeVersion: process.version,
    checks: {},
    risks: [],
  };

  try {
    console.log('Running typecheck...');
    execSync('npm run typecheck', { stdio: 'ignore' });
    report.checks.typecheck = 'PASS';
  } catch (e) {
    report.checks.typecheck = 'FAIL';
    report.risks.push('Typecheck failed. Build is unsafe.');
  }

  try {
    console.log('Running unit tests...');
    execSync('npm run test -- --run', { stdio: 'ignore' });
    report.checks.unitTests = 'PASS';
  } catch (e) {
    report.checks.unitTests = 'FAIL';
    report.risks.push('Unit tests failed.');
  }

  try {
    console.log('Running environment preflight...');
    execSync('npx tsx scripts/env-preflight.ts', { stdio: 'ignore' });
    report.checks.envPreflight = 'PASS';
  } catch (e) {
    report.checks.envPreflight = 'FAIL';
    report.risks.push('Environment preflight failed. Missing secrets.');
  }

  // Schema version from supabase migrations if possible
  const migrationsDir = path.join(process.cwd(), 'supabase', 'migrations');
  if (fs.existsSync(migrationsDir)) {
    const files = fs.readdirSync(migrationsDir, { withFileTypes: true })
      .filter(entry => entry.isFile() && entry.name.endsWith('.sql'))
      .map(entry => entry.name)
      .sort();
    report.schemaVersion = files.length > 0 ? files[files.length - 1] : 'unknown';
  } else {
    report.schemaVersion = 'unknown';
    report.risks.push('No migrations found.');
  }

  const isReady = !report.risks.length;
  report.readiness = isReady ? 'READY' : 'NOT_READY';

  const reportPath = path.join(process.cwd(), 'launch-certification.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  const mdPath = path.join(process.cwd(), 'launch-certification.md');
  const mdContent = `# Launch Certification Report
**Date:** ${report.timestamp}
**Commit:** \`${report.commit}\`
**Branch:** \`${report.branch}\`
**Env Mode:** \`${report.envMode}\`

## Readiness: ${isReady ? '✅ READY TO LAUNCH' : '❌ DO NOT LAUNCH'}

### Checks
- Typecheck: ${report.checks.typecheck === 'PASS' ? '✅' : '❌'}
- Unit Tests: ${report.checks.unitTests === 'PASS' ? '✅' : '❌'}
- Env Preflight: ${report.checks.envPreflight === 'PASS' ? '✅' : '❌'}

### Risks
${report.risks.length > 0 ? report.risks.map((r: string) => '- ' + r).join('\n') : '- None'}
`;
  fs.writeFileSync(mdPath, mdContent);
  
  console.log(`Certification written to ${reportPath} and ${mdPath}`);
  if (!isReady) {
    console.error('Launch Certification FAILED.');
    process.exit(1);
  } else {
    console.log('Launch Certification PASSED.');
  }
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
