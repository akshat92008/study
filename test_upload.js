const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const userId = "ede88892-8d43-45a8-8be1-7f193a2ae2f0";
    const materialId = "2935b464-bd76-49dd-aa7e-605717bf1aa7";
    const idempotencyKey = `test_ingest_${Date.now()}`;
    const { error: jobError } = await supabase
      .from('rag_ingestion_jobs')
      .upsert({
        user_id: userId,
        material_id: materialId,
        status: 'queued',
        idempotency_key: idempotencyKey,
        metadata: { mimeType: 'text/markdown' },
      }, { onConflict: 'user_id,material_id,idempotency_key' });
    console.log("jobError", jobError);

    const { data: eventId, error: eventError } = await supabase
      .rpc('create_event_with_consumers', {
        p_user_id: userId,
        p_type: 'MATERIAL_UPLOADED',
        p_data: { materialId, mimeType: 'text/markdown' },
        p_idempotency_key: `event_${idempotencyKey}`,
        p_source: 'upload',
        p_metadata: {}
      });
    console.log("eventId", eventId, "eventError", eventError);
  } catch(e) { console.error(e) }
}
run();
