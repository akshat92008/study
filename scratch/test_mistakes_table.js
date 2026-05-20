const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
  console.log("Checking mistakes...");
  const { data: d1, error: e1 } = await supabase.from('mistakes').select('*').limit(1);
  if (e1) console.error("Mistakes error:", e1.message);
  else console.log("Mistakes success! count:", d1.length);

  console.log("Checking mistake_records...");
  const { data: d2, error: e2 } = await supabase.from('mistake_records').select('*').limit(1);
  if (e2) console.error("Mistake_records error:", e2.message);
  else console.log("Mistake_records success! count:", d2.length);
}

check();
