import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyIdempotency() {
  console.log('Testing chat message idempotency...');
  const userId = '00000000-0000-0000-0000-000000000000'; // mock user
  const sessionId = 'test-session-id';
  const idempotencyKey = `req-id-${Date.now()}:assistant`;

  // 1. First insert
  const { data: data1, error: err1 } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: 'Hello World',
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (err1) {
    console.error('First insert failed:', err1.message);
    return;
  }
  console.log('First insert succeeded, id:', data1.id);

  // 2. Duplicate insert (should fail with unique_violation, but let's simulate the service layer logic)
  const { data: data2, error: err2 } = await supabase
    .from('chat_messages')
    .insert({
      session_id: sessionId,
      user_id: userId,
      role: 'assistant',
      content: 'Hello World',
      idempotency_key: idempotencyKey,
    })
    .select('id')
    .single();

  if (err2) {
    if (err2.code === '23505') {
      console.log('Duplicate insert correctly rejected with unique_violation (23505).');
    } else {
      console.error('Duplicate insert failed with unexpected error:', err2);
    }
  } else {
    console.error('Duplicate insert succeeded unexpectedly! Idempotency failed.');
  }

  // Cleanup
  await supabase.from('chat_messages').delete().eq('id', data1.id);
  console.log('Test completed.');
}

verifyIdempotency().catch(console.error);
