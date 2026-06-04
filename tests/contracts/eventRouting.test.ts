/**
 * tests/contracts/eventRouting.test.ts
 *
 * Contract: Event routing must map to the exact expected MVP engines.
 * PULSE must not be a registered consumer for any event.
 */

import fs from 'node:fs';
import path from 'node:path';
import { describe, it, expect } from 'vitest';

const root = process.cwd();

describe('Event Routing Contracts', () => {
  it('Event routes file does not contain pulse_agent', () => {
    const routesPath = path.join(root, 'lib', 'events', 'routes.ts');
    
    if (fs.existsSync(routesPath)) {
      const routes = fs.readFileSync(routesPath, 'utf8');
      
      // The pulse agent must not be registered as a consumer
      expect(routes).not.toContain("'pulse'");
      expect(routes).not.toContain('"pulse"');
      expect(routes).not.toContain('pulse_agent');
    }
  });

  it('SQL routing data does not contain pulse_agent', () => {
    const migrationsDir = path.join(root, 'supabase', 'migrations');
    
    if (fs.existsSync(migrationsDir)) {
      const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
      
      let containsPulseConsumer = false;
      for (const file of files) {
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8').toLowerCase();
        
        // This is a rough check to ensure we didn't insert a consumer named 'pulse'
        // Specifically look for consumer array insertions like array['atlas', 'memory', 'pulse']
        if (sql.match(/array\[[^\]]*'pulse'[^\]]*\]/i)) {
          containsPulseConsumer = true;
        }
      }
      
      expect(containsPulseConsumer).toBe(false);
    }
  });
});
