/**
 * tests/workers/drainLoop.test.ts
 *
 * Contract: The event queue drain loop must be strictly bounded.
 * It cannot use an unbounded while(true) loop which could run infinitely
 * if failing events are continuously retried.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();

describe('Drain Loop Safety Contracts', () => {
  it('drain-loop script must not use unbounded while(true)', () => {
    const drainLoopPath = path.join(root, 'scripts', 'drain-loop.ts');
    
    // Test passes if file doesn't exist (e.g. renamed/deleted)
    if (!fs.existsSync(drainLoopPath)) {
      return;
    }
    
    const drainLoop = fs.readFileSync(drainLoopPath, 'utf8');
    
    // The script must not contain while(true) or while (true) or while(1)
    const whileTruePattern = /while\s*\(\s*(true|1)\s*\)/i;
    expect(whileTruePattern.test(drainLoop)).toBe(false);
    
    // The script should use a bounded for-loop with MAX_BATCHES
    expect(drainLoop).toContain('MAX_BATCHES');
    expect(drainLoop).toContain('for (let');
  });
});
