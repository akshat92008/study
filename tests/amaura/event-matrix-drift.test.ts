import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_CONSUMER_MATRIX } from '@/lib/events/routes';

const root = process.cwd();

describe('Amaura event matrix drift protection', () => {
  it('verifies that every Amaura event and consumer in TS exists in SQL', () => {
    const migrationPath = path.join(
      root,
      'supabase/migrations/20260606120000_amaura_agentic_runtime.sql'
    );
    const sqlContent = fs.readFileSync(migrationPath, 'utf8');

    // Extract the mappings from the case statement in create_event_with_consumers
    const sqlMappings: Record<string, string[]> = {};
    const caseMatches = sqlContent.matchAll(/when\s+'([^']+)'\s+then\s+array\[([^\]]+)\]/gi);

    for (const match of caseMatches) {
      const eventType = match[1];
      const consumers = match[2]
        .split(',')
        .map((c) => c.trim().replace(/'/g, ''));
      sqlMappings[eventType] = consumers;
    }

    const missingEvents: string[] = [];
    const mismatchedConsumers: string[] = [];
    const staleHermesConsumers: string[] = [];

    // Check every event in TS matrix
    for (const [eventType, tsConsumers] of Object.entries(EVENT_CONSUMER_MATRIX)) {
      const sqlConsumers = sqlMappings[eventType];
      if (!sqlConsumers) {
        // If it's an Amaura event, it MUST be in SQL
        if (eventType.startsWith('AMAURA_') || eventType.includes('AUTOPSY_V3') || eventType.includes('SESSION_CLOSED')) {
          missingEvents.push(eventType);
        }
        continue;
      }

      // Verify every Amaura consumer in the TS matrix exists in the SQL function
      for (const consumer of tsConsumers) {
        if (!sqlConsumers.includes(consumer)) {
          mismatchedConsumers.push(`${eventType}: TS has ${consumer} but SQL does not`);
        }
      }
    }

    // It should fail if SQL contains a stale Hermes consumer such as hermes_worker
    for (const [eventType, sqlConsumers] of Object.entries(sqlMappings)) {
      for (const consumer of sqlConsumers) {
        if (consumer === 'hermes_worker') {
          staleHermesConsumers.push(`${eventType}: SQL contains stale hermes_worker`);
        }
      }
    }

    expect(missingEvents, 'Amaura events missing from SQL migration').toEqual([]);
    expect(mismatchedConsumers, 'Amaura consumers mismatch between TS and SQL').toEqual([]);
    expect(staleHermesConsumers, 'Stale Hermes consumers found in SQL migration').toEqual([]);
  });

  it('verifies that SQL does not have extra consumers for Amaura events not in TS', () => {
      // This is a bonus check to ensure they are in sync
      const migrationPath = path.join(
        root,
        'supabase/migrations/20260606120000_amaura_agentic_runtime.sql'
      );
      const sqlContent = fs.readFileSync(migrationPath, 'utf8');
  
      const sqlMappings: Record<string, string[]> = {};
      const caseMatches = sqlContent.matchAll(/when\s+'([^']+)'\s+then\s+array\[([^\]]+)\]/gi);
  
      for (const match of caseMatches) {
        const eventType = match[1];
        const consumers = match[2]
          .split(',')
          .map((c) => c.trim().replace(/'/g, ''));
        sqlMappings[eventType] = consumers;
      }

      const extraSqlConsumers: string[] = [];

      for (const [eventType, sqlConsumers] of Object.entries(sqlMappings)) {
          if (eventType.startsWith('AMAURA_')) {
              const tsConsumers = EVENT_CONSUMER_MATRIX[eventType as keyof typeof EVENT_CONSUMER_MATRIX];
              for (const consumer of sqlConsumers) {
                  if (!tsConsumers || !tsConsumers.includes(consumer as any)) {
                      extraSqlConsumers.push(`${eventType}: SQL has ${consumer} but TS does not`);
                  }
              }
          }
      }

      expect(extraSqlConsumers, 'Extra consumers in SQL not found in TS').toEqual([]);
  });
});
