import { Client } from 'pg';
import * as dotenv from 'dotenv';
import path from 'path';

// Load env vars, prioritizing local config for script execution
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config(); // fallback

async function main() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:54322/postgres';
  
  console.log(`Connecting to database at: ${connectionString.split('@')[1] || connectionString}`);
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected successfully. Starting sanity checks...\n');

    const requiredTables = [
      'profiles',
      'chat_sessions',
      'chat_messages', 
      'event_queue',
      'consumer_locks',
      'study_materials',
      'rag_ingestion_jobs',
      'revision_cards',
      'mistakes',
      'mastery_evidence_ledger',
      'mock_autopsies',
      'autopsy_questions',
      'practice_sets',
      'ai_budget_reservations',
      'ai_usage_events'
    ];
    
    const optionalTables = [
      'event_dlq',
      'uploaded_materials'
    ];
    
    const requiredRoutines = [
      'create_event_with_consumers'
    ];

    const requiredColumns: Record<string, string[]> = {
      'profiles': ['id'],
      'chat_sessions': ['id', 'user_id'],
      'chat_messages': ['id', 'session_id', 'role', 'content'],
      'event_queue': ['id', 'event_type', 'payload', 'status'],
      'consumer_locks': ['event_id', 'consumer_id'],
      'study_materials': ['id', 'user_id', 'content_hash'],
      'mock_autopsies': ['id', 'user_id'],
      'ai_budget_reservations': ['id', 'user_id', 'status', 'feature', 'reserved_at', 'expires_at'],
      'ai_usage_events': ['id', 'user_id', 'feature', 'prompt_tokens', 'completion_tokens']
    };

    let allPassed = true;

    // 1. Check Tables
    for (const table of requiredTables) {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (!res.rows[0].exists) {
        console.error(`[FAIL] Missing required table: public.${table}`);
        allPassed = false;
      } else {
        console.log(`[OK] Table found: public.${table}`);
      }
    }

    // 2. Check Optional Tables
    for (const table of optionalTables) {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);
      
      if (!res.rows[0].exists) {
        console.log(`[INFO] Optional table not present (as expected if not used): public.${table}`);
      } else {
        console.log(`[OK] Optional table found: public.${table}`);
      }
    }

    // 3. Check Required Columns
    for (const [table, columns] of Object.entries(requiredColumns)) {
      // First check if table exists to avoid noise
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        );
      `, [table]);

      if (tableExists.rows[0].exists) {
        for (const col of columns) {
          const colRes = await client.query(`
            SELECT EXISTS (
              SELECT FROM information_schema.columns 
              WHERE table_schema = 'public' 
              AND table_name = $1 
              AND column_name = $2
            );
          `, [table, col]);
          
          if (!colRes.rows[0].exists) {
            console.error(`[FAIL] Missing column in public.${table}: ${col}`);
            allPassed = false;
          } else {
            console.log(`[OK] Column found: public.${table}.${col}`);
          }
        }
      }
    }

    // 4. Check Routines
    for (const routine of requiredRoutines) {
      const res = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.routines 
          WHERE routine_schema = 'public' 
          AND routine_name = $1
        );
      `, [routine]);
      
      if (!res.rows[0].exists) {
        console.error(`[FAIL] Missing required function: public.${routine}`);
        allPassed = false;
      } else {
        console.log(`[OK] Function found: public.${routine}`);
      }
    }

    if (!allPassed) {
      console.error('\n[ERROR] Schema Sanity Check FAILED. Critical schema elements are missing.');
      process.exit(1);
    } else {
      console.log('\n[SUCCESS] Schema Sanity Check PASSED.');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n[FATAL] Error during schema sanity check:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
