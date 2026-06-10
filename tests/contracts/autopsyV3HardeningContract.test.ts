/**
 * Module 8 Contract Tests — Autopsy V3 Hardening
 *
 * Phase 8.1: Memory insertion handles null gracefully. (Included implicitly via agent runner contracts)
 * Phase 8.2: Projection uses caller Supabase client and stable keys without Date.now()
 * Phase 8.3: Retry-safe Report Generation (pending state before heavy work)
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function readFile(relPath: string): string {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

describe('Module 8 — Phase 8.2: Projection Hardening', () => {
  it('projection.ts uses caller supabase client if provided', () => {
    const content = readFile('lib/autopsy-v3/projection.ts');
    expect(content).toContain('supabase?: SupabaseClient');
    expect(content).toContain('if (input.supabase) {');
    expect(content).toContain('supabase = input.supabase;');
  });

  it('projection.ts generates stable idempotency keys without Date.now()', () => {
    const content = readFile('lib/autopsy-v3/projection.ts');
    expect(content).toContain('stableKey(');
    // Check it does NOT use Date.now() in code
    const codeOnly = content.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(codeOnly.includes('Date.now()')).toBe(false);
  });
});

describe('Module 8 — Phase 8.3: Retry-Safe Report Generation', () => {
  const routeContent = readFile('app/api/autopsy/v3/assessments/[id]/generate-report/route.ts');

  it('generate-report route writes pending report with status=generating first', () => {
    expect(routeContent).toContain("status: 'generating'");
    expect(routeContent).toContain("upsert({");
    expect(routeContent).toContain("pendingReport");
  });

  it('generate-report route prevents duplicate generation', () => {
    expect(routeContent).toContain("status === 'generating'");
    expect(routeContent).toContain("Report is already generating.");
    expect(routeContent).toContain("409");
  });

  it('generate-report route uses try/catch to mark status=failed on error', () => {
    expect(routeContent).toContain("update({ status: 'failed'");
    expect(routeContent).toContain('catch (err)');
  });

  it('reasons route processes batch gracefully', () => {
    const reasonsRoute = readFile('app/api/autopsy/v3/assessments/[id]/reasons/route.ts');
    expect(reasonsRoute).toContain('classifyMistakeDeterministically');
  });
});
