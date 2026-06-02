import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { EVENT_CONSUMER_MATRIX } from '@/lib/events/routes';

const root = process.cwd();

function latestCreateEventMigration() {
  const dir = path.join(root, 'supabase', 'migrations');
  const files = fs.readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const matches = files.filter((file) =>
    fs.readFileSync(path.join(dir, file), 'utf8')
      .includes('create or replace function public.create_event_with_consumers')
  );

  expect(matches.length).toBeGreaterThan(0);
  const file = matches.at(-1)!;
  return {
    file,
    sql: fs.readFileSync(path.join(dir, file), 'utf8'),
  };
}

function extractSqlRouteMatrix(sql: string): Record<string, string[]> {
  const matrix: Record<string, string[]> = {};
  const routePattern = /when\s+'([^']+)'\s+then\s+array\s*\[([\s\S]*?)\]/gi;

  for (const match of sql.matchAll(routePattern)) {
    matrix[match[1]] = Array.from(match[2].matchAll(/'([^']+)'/g), (consumer) => consumer[1]);
  }

  return matrix;
}

describe('event routing SQL/TypeScript contract', () => {
  it('keeps create_event_with_consumers exactly aligned with the TypeScript route matrix', () => {
    const { file, sql } = latestCreateEventMigration();
    const sqlMatrix = extractSqlRouteMatrix(sql);

    expect(file).toBe('20260602000300_cheap_agentic_os_core.sql');
    expect(sqlMatrix).toEqual(EVENT_CONSUMER_MATRIX);
  });

  it('routes all MVP learner-state events to non-empty consumer sets', () => {
    const mvpEvents = [
      'CHAT_MESSAGE_PROCESSED',
      'AUTOPSY_UPLOAD_RECEIVED',
      'AUTOPSY_MOCK_PROCESSED',
      'STUDY_SESSION_COMPLETED',
      'MIND_TUTOR_COMPLETED',
      'MEMORY_CARD_CREATED',
      'MEMORY_CARD_REVIEWED',
      'MATERIAL_UPLOADED',
      'MATERIAL_INGESTED',
      'AUTOPSY_MISTAKE_APPROVED',
      'STUDENT_MODEL_SYNC_REQUESTED',
      'PRACTICE_ATTEMPT_RECORDED',
      'PRACTICE_ATTEMPT_SUBMITTED',
      'CHAT_LEARNING_SIGNAL',
    ] as const;

    for (const event of mvpEvents) {
      expect(EVENT_CONSUMER_MATRIX[event]?.length, `${event} has consumers`).toBeGreaterThan(0);
    }

    expect(EVENT_CONSUMER_MATRIX.AUTOPSY_MOCK_PROCESSED).toEqual([
      'atlas_engine',
      'memory_engine',
      'learning_state_engine',
      'command_agent',
      'planner_agent',
    ]);
    expect(EVENT_CONSUMER_MATRIX.STUDY_SESSION_COMPLETED).toContain('learning_state_engine');
    expect(EVENT_CONSUMER_MATRIX.STUDENT_MODEL_SYNC_REQUESTED).toEqual([
      'learning_state_engine',
      'command_engine',
    ]);
  });

  it('does not register PULSE as an event product consumer', () => {
    const { sql } = latestCreateEventMigration();
    const tsText = fs.readFileSync(path.join(root, 'lib', 'events', 'routes.ts'), 'utf8');
    const routeText = `${tsText}\n${sql}`.toLowerCase();

    expect(routeText).not.toContain('pulse_engine');
    expect(routeText).not.toMatch(/array\s*\[[^\]]*['"]pulse_agent['"]/);
  });
});
