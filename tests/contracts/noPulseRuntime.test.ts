/**
 * tests/contracts/noPulseRuntime.test.ts
 *
 * Contract: PULSE must be fully dormant in the MVP runtime.
 * - Not imported or registered in orchestrator
 * - Not routing to pulse_rule_agent source_type in action-executor
 * - Not reachable via any app/api route
 * - Not present as active event consumer
 * - flag_student_risk not in SAFE_AUTO policy
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();

function read(file: string): string {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function listFilesRecursive(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...listFilesRecursive(fullPath));
      } else {
        results.push(fullPath);
      }
    }
  } catch {
    // ignore unreadable dirs
  }
  return results;
}

describe('PULSE Runtime Dormancy Contracts', () => {
  it('orchestrator does NOT import or register runPulseRuleAgent', () => {
    const orchestrator = read('lib/agents/orchestrator.ts');
    expect(orchestrator).not.toContain('runPulseRuleAgent');
    // PULSE should not be in the RULE_AGENTS array (active registration)
    // Allow commented-out references, but not active ones
    const activePulsePattern = /\{\s*name:\s*['"]PULSE['"]\s*,\s*run:/;
    expect(activePulsePattern.test(orchestrator)).toBe(false);
  });

  it('action-executor does NOT write source_type = pulse_rule_agent', () => {
    const executor = read('lib/agents/action-executor.ts');
    // The flagStudentRisk function must not write 'pulse_rule_agent'
    // The disabled version should throw, not write to DB
    expect(executor).not.toContain("source_type: 'pulse_rule_agent'");
    expect(executor).not.toContain('source_type: "pulse_rule_agent"');
  });

  it('action-executor does NOT have an active flag_student_risk case', () => {
    const executor = read('lib/agents/action-executor.ts');
    // Active (non-commented) case
    const activeCasePattern = /^\s*case 'flag_student_risk':/m;
    expect(activeCasePattern.test(executor)).toBe(false);
  });

  it('action-policy does NOT have flag_student_risk in SAFE_AUTO', () => {
    const policy = read('lib/agents/action-policy.ts');
    // Active (non-commented) entry
    const activeEntryPattern = /^\s*'flag_student_risk',/m;
    expect(activeEntryPattern.test(policy)).toBe(false);
  });

  it('no app/api route file path contains "pulse"', () => {
    const apiDir = path.join(root, 'app', 'api');
    const files = listFilesRecursive(apiDir);
    const pulseFiles = files.filter(f => f.toLowerCase().includes('pulse'));
    expect(pulseFiles).toHaveLength(0);
  });

  it('CheapAgentName type does NOT include PULSE as active member', () => {
    const cheapTypes = read('lib/agents/cheap-types.ts');
    // Active (non-commented) PULSE union member
    const activePulsePattern = /^\s*\| 'PULSE'/m;
    expect(activePulsePattern.test(cheapTypes)).toBe(false);
  });

  it('AgentNameSchema does NOT include pulse as active enum member', () => {
    const types = read('lib/agents/types.ts');
    // Active (non-commented) entry
    const activePulsePattern = /^\s*'pulse',/m;
    expect(activePulsePattern.test(types)).toBe(false);
  });

  it('PULSE rule agent file exists but is never imported by active runtime', () => {
    // The file can exist (for post-alpha re-enablement), but must not be imported
    const orchestrator = read('lib/agents/orchestrator.ts');
    // Only allow commented imports
    const activeImportPattern = /^import\s+\{[^}]*runPulseRuleAgent/m;
    expect(activeImportPattern.test(orchestrator)).toBe(false);
  });
});
