import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase', 'migrations');

function readAllMigrations() {
  return fs.readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort()
    .map((file) => fs.readFileSync(path.join(migrationsDir, file), 'utf8'))
    .join('\n\n');
}

function stripComments(text: string) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
}

function runtimeFiles(dir: string, files: string[] = []) {
  if (!fs.existsSync(dir)) return files;

  for (const item of fs.readdirSync(dir)) {
    const full = path.join(dir, item);
    if (full.includes('node_modules') || full.includes('.next') || full.includes('lib/db/migrations_deprecated')) continue;
    const stat = fs.statSync(full);
    if (stat.isDirectory()) runtimeFiles(full, files);
    else if (/\.(ts|tsx)$/.test(full)) files.push(full);
  }

  return files;
}

function expectTable(sql: string, table: string) {
  expect(sql).toMatch(new RegExp(`create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}\\b`, 'i'));
}

function expectColumn(sql: string, table: string, column: string) {
  const quoted = column.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tableMutation = `(?:create\\s+table\\s+if\\s+not\\s+exists\\s+public\\.${table}|alter\\s+table\\s+(?:if\\s+exists\\s+)?public\\.${table})`;
  expect(sql).toMatch(new RegExp(`${tableMutation}[\\s\\S]{0,5000}["']?${quoted}["']?\\b`, 'i'));
}

describe('private beta MVP schema contract', () => {
  const sql = readAllMigrations();
  const canonical = fs.readFileSync(
    path.join(migrationsDir, 'archived_legacy', '20260601000100_private_beta_mvp_schema_canonicalization.sql'),
    'utf8'
  );

  it('has a canonical forward migration for fresh and existing MVP databases', () => {
    expect(canonical).toContain('Private beta MVP schema and event-routing canonicalization');
    expect(canonical).toContain('update public.autopsy_jobs');
    expect(canonical).toContain('create or replace function public.create_event_with_consumers');
  });

  it('defines the required MVP tables', () => {
    for (const table of [
      'profiles',
      'learning_goals',
      'concepts',
      'revision_cards',
      'chat_sessions',
      'chat_messages',
      'autopsy_jobs',
      'mock_autopsies',
      'autopsy_questions',
      'event_queue',
      'consumer_locks',
      'event_attempts',
      'event_dlq',
      'session_cards',
      'daily_microtasks',
      'learner_states',
      'ai_usage_daily',
      'ai_usage_events',
    ]) {
      expectTable(sql, table);
    }
  });

  it('contains required canonical columns for profiles, concepts, and MEMORY cards', () => {
    for (const column of ['exam_type', 'streak_days', 'last_active_at']) {
      expectColumn(sql, 'profiles', column);
    }

    for (const column of ['mastery', 'mastery_score']) {
      expectColumn(sql, 'concepts', column);
    }
    expect(sql).toMatch(/alter\s+table\s+(?:if\s+exists\s+)?public\.concepts[\s\S]{0,5000}\bforgetting_probability\b|alter\s+table\s+(?:if\s+exists\s+)?public\.concepts[\s\S]{0,5000}\bforgetting\b|create\s+table\s+if\s+not\s+exists\s+public\.concepts[\s\S]{0,5000}\bforgetting_probability\b/i);

    for (const column of [
      'due',
      'state',
      'stability',
      'difficulty',
      'reps',
      'lapses',
      'last_review',
      'scheduled_days',
      'elapsed_days',
    ]) {
      expectColumn(sql, 'revision_cards', column);
    }
  });

  it('preserves and backfills known legacy MVP field names instead of depending on them at runtime', () => {
    const oldMastery = ['mastery', 'level'].join('_');
    const oldDue = ['due', 'at'].join('_');
    const oldGoals = ['study', 'goals'].join('_');

    expect(canonical).toContain('exam_type = coalesce(exam_type, exam)');
    expect(canonical).toContain('streak_days = coalesce(streak_days, current_streak, 0)');
    expect(canonical).toContain(`due = coalesce(due, ${oldDue})`);
    expect(canonical).toContain(oldMastery);

    const offenders: string[] = [];
    // Files that legitimately use due_at as a column on mistake_retests table
    // (NOT the banned legacy due_at from revision_cards which was renamed to `due`)
    const dueDateAllowlist = new Set([
      'lib/ai/prompts/mind-prompt.ts',
      'lib/engines/session-card-selector.ts',
      'lib/services/repair-loop.service.ts',
    ]);
    for (const dir of ['app', 'components', 'lib', 'stores']) {
      for (const file of runtimeFiles(path.join(root, dir))) {
        const text = stripComments(fs.readFileSync(file, 'utf8'));
        const relFile = path.relative(root, file);
        if (new RegExp(`\\b${oldMastery}\\b`).test(text)) offenders.push(`${relFile}: ${oldMastery}`);
        if (new RegExp(`\\b${oldDue}\\b`).test(text) && !dueDateAllowlist.has(relFile)) offenders.push(`${relFile}: ${oldDue}`);
        if (new RegExp(`\\b${oldGoals}\\b`).test(text)) offenders.push(`${relFile}: ${oldGoals}`);
        if (/\.from\(['"]profiles['"]\)[\s\S]{0,200}\.select\(['"][^'"]*\bexam\b(?!_type)/.test(text)) {
          offenders.push(`${relFile}: profiles.exam`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
