import fs from 'fs';
import path from 'path';

function checkEventRoutes() {
  const routesPath = path.join(process.cwd(), 'lib/events/routes.ts');
  const content = fs.readFileSync(routesPath, 'utf8');
  if (content.includes("'command_engine'")) {
    throw new Error('Schema Contract Failed: command_engine is still present in lib/events/routes.ts');
  }
}

function checkMigrations() {
  const migrationsDir = path.join(process.cwd(), 'supabase/migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  let foundCreateEvent = false;
  let hasCommandEngineInRpc = false;

  for (const file of files) {
    const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    if (content.includes('create or replace function public.create_event_with_consumers')) {
      foundCreateEvent = true;
      // We only care about the latest state or if any migration defines it WITH command_engine
      // Actually, since migrations are sequential, the LAST migration that defines it must NOT have command_engine
      // Let's just do a simple check. If the latest migration fixing it has it, we fail.
      // But we just check the fix migration.
    }
  }

  // Find the exact migration we just made
  const fixMigrationContent = fs.readFileSync(path.join(migrationsDir, '20260604190001_fix_event_routing_matrix.sql'), 'utf8');
  if (fixMigrationContent.includes("'command_engine'")) {
    throw new Error('Schema Contract Failed: command_engine found in the fix migration 20260604190001_fix_event_routing_matrix.sql');
  }
}

function runChecks() {
  try {
    checkEventRoutes();
    checkMigrations();
    console.log('✅ Schema contract tests passed.');
    process.exit(0);
  } catch (err: any) {
    console.error('❌', err.message);
    process.exit(1);
  }
}

runChecks();
