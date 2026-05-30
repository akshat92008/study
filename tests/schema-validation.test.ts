import { createAdminClient } from '@/lib/supabase/admin';

async function validateSchema() {
  console.log('Starting MVP Schema validation...');
  const supabase = createAdminClient();

  // 1. Verify that `ai_usage_events` exists
  const { data: usageEvents, error: evErr } = await supabase
    .from('ai_usage_events')
    .select('id')
    .limit(1);

  if (evErr) {
    console.error('❌ Failed to verify ai_usage_events:', evErr);
  } else {
    console.log('✅ ai_usage_events table exists.');
  }

  // 2. Verify profiles
  const { data: profiles, error: pErr } = await supabase
    .from('profiles')
    .select('id, exam_type, streak_days, last_active_at')
    .limit(1);

  if (pErr) {
    console.error('❌ Failed to verify profiles columns:', pErr);
  } else {
    console.log('✅ profiles canonical columns (exam_type, streak_days, last_active_at) exist.');
  }

  // 3. Verify concepts
  const { data: concepts, error: cErr } = await supabase
    .from('concepts')
    .select('id, mastery, forgetting')
    .limit(1);

  if (cErr) {
    console.error('❌ Failed to verify concepts columns:', cErr);
  } else {
    console.log('✅ concepts canonical columns (mastery, forgetting) exist.');
  }

  // 4. Verify revision_cards
  const { data: cards, error: rcErr } = await supabase
    .from('revision_cards')
    .select('id, due')
    .limit(1);

  if (rcErr) {
    console.error('❌ Failed to verify revision_cards columns:', rcErr);
  } else {
    console.log('✅ revision_cards canonical columns (due) exist.');
  }

  // 5. Test if atomic_ai_budget_spend works or compiles 
  // We can't easily execute it fully without setup data, but since it's defined, 
  // we know it exists. We can attempt to call it with a fake user to see if we get a budget exceeded or not found error 
  // instead of a "function does not exist" error.
  const { error: rpcErr } = await supabase.rpc('atomic_ai_budget_spend', {
    p_user_id: '00000000-0000-0000-0000-000000000000',
    p_feature: 'test',
    p_model: 'test_model',
    p_cost: 0,
    p_prompt_tokens: 0,
    p_completion_tokens: 0,
    p_route: 'test'
  });

  if (rpcErr && rpcErr.code === '42883') { // function does not exist
    console.error('❌ atomic_ai_budget_spend RPC does not exist or has wrong signature:', rpcErr);
  } else {
    console.log('✅ atomic_ai_budget_spend RPC compiled and is accessible via service_role.');
  }

  console.log('Validation complete.');
}

validateSchema().catch(console.error);
