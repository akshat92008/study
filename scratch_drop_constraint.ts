import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function drop() {
  const { error } = await supabase.rpc('exec_sql', {
    sql_string: 'ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_exam_type_check;'
  });

  if (error) {
    // If exec_sql doesn't exist, we can create a temporary RPC to run it or use another method.
    console.error('Error with exec_sql:', error.message);
  } else {
    console.log('Successfully dropped the constraint via exec_sql.');
  }
}

drop();
