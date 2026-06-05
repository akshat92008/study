import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const requiredEnv = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'INTERNAL_CRON_SECRET',
];

function pass(message: string) {
  console.log(`PASS ${message}`);
}

function fail(message: string): never {
  console.error(`FAIL ${message}`);
  throw new Error(message);
}

async function main() {
  for (const key of requiredEnv) {
    if (!process.env[key]) fail(`missing ${key}`);
  }
  pass('required environment variables are present');

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const requiredTables = [
    'profiles',
    'feature_usage_events',
    'event_queue',
    'event_dlq',
    'assessments',
    'autopsy_reports',
    'revision_cards',
    'study_materials',
    'app_error_events',
  ];

  for (const table of requiredTables) {
    const { error } = await supabase.from(table).select('*', { count: 'exact', head: true }).limit(1);
    if (error) fail(`${table} unavailable: ${error.message}`);
  }
  pass('required beta tables are reachable');

  const { error: usageInsertError, data: usageRow } = await supabase
    .from('feature_usage_events')
    .insert({
      user_id: '00000000-0000-0000-0000-000000000000',
      feature: 'chat_message',
      amount: 1,
      status: 'released',
      metadata: { smoke: true },
    })
    .select('id')
    .maybeSingle();

  if (usageInsertError && !usageInsertError.message.includes('violates foreign key')) {
    fail(`feature usage insert path failed unexpectedly: ${usageInsertError.message}`);
  }
  if (usageRow?.id) {
    await supabase.from('feature_usage_events').delete().eq('id', usageRow.id);
  }
  pass('feature usage events enforce relational safety');

  console.log('PASS manual beta smoke completed');
}

main().catch(() => process.exit(1));
