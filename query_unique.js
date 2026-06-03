const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const query = `
  SELECT
    tc.table_name, 
    tc.constraint_name, 
    tc.constraint_type,
    kcu.column_name
  FROM information_schema.table_constraints tc
  JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
  WHERE tc.table_name = 'rag_ingestion_jobs' 
    AND tc.constraint_type = 'UNIQUE';
`;
supabase.rpc('exec_sql', { sql: query }).then(res => console.log("exec_sql res:", res));
// Wait, we don't have exec_sql.
