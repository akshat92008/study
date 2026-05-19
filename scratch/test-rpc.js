const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

async function main() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_ip: '127.0.0.1',
    p_limit: 10,
    p_window_seconds: 60
  });

  console.log('Result:', { data, error });
}

main();
