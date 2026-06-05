import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'app/api/hermes/command/route.ts'), 'utf8');

describe('Hermes command API contract', () => {
  it('authenticates, rate limits, classifies, plans, and executes', () => {
    expect(source).toContain('supabase.auth.getUser');
    expect(source).toContain("bucket: 'hermes-command'");
    expect(source).toContain('classifyHermesIntent');
    expect(source).toContain('getHermesUserState');
    expect(source).toContain('planHermesAction');
    expect(source).toContain('executeHermesPlan');
  });

  it('returns card response fields', () => {
    expect(source).toContain('cards: executed.cards');
    expect(source).toContain('usedLLM: executed.usedLLM');
    expect(source).toContain('costMode: executed.costMode');
  });
});
