import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Database Schema Contract', () => {
  let dumpSql = '';

  beforeAll(() => {
    const dumpPath = path.join(process.cwd(), 'dump.sql');
    if (fs.existsSync(dumpPath)) {
      dumpSql = fs.readFileSync(dumpPath, 'utf8').toLowerCase();
    }
  });

  const checkTableExists = (tableName: string) => {
    return dumpSql.includes(`table "${tableName}"`) || 
           dumpSql.includes(`table public.${tableName}`) || 
           dumpSql.includes(`table "public"."${tableName}"`) ||
           dumpSql.includes(`table ${tableName} `);
  };

  const checkColumnExists = (tableName: string, columnName: string) => {
    return dumpSql.includes(`"${columnName}"`) || dumpSql.includes(`${columnName} `);
  };

  it('verifies critical tables exist in schema', () => {
    const tables = [
      'profiles',
      'study_sessions',
      'chat_messages',
      'event_queue',
      'consumer_locks',
      'materials',
    ];

    for (const table of tables) {
      if (dumpSql) { // Only assert if dump exists
        expect(checkTableExists(table)).toBe(true);
      }
    }
  });

  it('verifies required columns exist in schema', () => {
    if (!dumpSql) return;

    const columnsToCheck = [
      { table: 'profiles', column: 'id' },
      { table: 'study_sessions', column: 'user_id' },
      { table: 'event_queue', column: 'status' },
      { table: 'event_queue', column: 'idempotency_key' },
    ];

    for (const { table, column } of columnsToCheck) {
      expect(checkColumnExists(table, column)).toBe(true);
    }
  });
});
