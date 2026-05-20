const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
  console.log("Checking learner_states table...");
  const { data: data1, error: error1 } = await supabase
    .from('learner_states')
    .select('*')
    .limit(1);

  if (error1) {
    console.error("learner_states check failed:", error1.message);
  } else {
    console.log("learner_states exists! Data:", data1);
  }

  console.log("\nChecking learner_daily_metrics table...");
  const { data: data2, error: error2 } = await supabase
    .from('learner_daily_metrics')
    .select('*')
    .limit(1);

  if (error2) {
    console.error("learner_daily_metrics check failed:", error2.message);
  } else {
    console.log("learner_daily_metrics exists! Data:", data2);
  }
}

check();
