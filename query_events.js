const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.from('event_queue').select('id, type, status, created_at, data').eq('type', 'MATERIAL_UPLOADED').order('created_at', { ascending: false }).limit(5).then(res => console.log(JSON.stringify(res.data, null, 2)));
