import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function checkRLS() {
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  // List of tables we expect to have RLS enabled
  const tables = [
    'profiles',
    'concepts',
    'concept_links',
    'mistakes',
    'revision_cards',
    'review_logs',
    'study_tasks',
    'mock_tests',
    'performance_snapshots',
    'mentor_chats',
    'tutor_sessions',
    'study_sessions',
    'materials',
    'material_chunks',
    'mock_autopsies',
    'autopsy_questions',
    'recovery_plans',
    'pulse_signals'
  ];

  console.log("=== CHECKING RLS POLICIES FOR OPERATIONAL TABLES ===");
  
  // Query pg_tables to check rowsecurity status
  const { data: rlsStatus, error } = await supabase.rpc('execute_sql', {
    sql_query: `
      SELECT tablename, rowsecurity 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN (${tables.map(t => `'${t}'`).join(', ')});
    `
  });

  if (error) {
    // If execute_sql RPC is not exposed or fails, try querying pg_policies via a generic query if possible, 
    // or we can run a custom SQL execution or query via direct client.
    console.error("RPC execute_sql failed:", error.message);
    
    // Let's fallback to query using a direct select or another method if we don't have execute_sql RPC.
    // We can also just run it by querying pg_policies if the schema exposes it, or we can check policies 
    // by trying to do a select with non-admin/anon credentials.
    console.log("Attempting fallback check...");
  } else {
    console.log("RLS Status per table:");
    console.table(rlsStatus);
    
    const disabled = (rlsStatus as any[]).filter(r => !r.rowsecurity);
    if (disabled.length > 0) {
      console.warn("⚠️ Warning: The following tables do not have RLS enabled:", disabled.map(d => d.tablename));
    } else {
      console.log("✅ All checked tables have RLS enabled!");
    }
  }
}

checkRLS();
