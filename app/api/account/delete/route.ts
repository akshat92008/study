import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const response = NextResponse.json({ ok: true });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => req.cookies.getAll(),
        setAll: (cookiesToSet: any[]) => {
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // To securely delete an account from the client, they can call an RPC function or we handle it via admin
  // For security, an RPC function `delete_own_account` is preferred.
  const { error: deleteError } = await supabase.rpc('delete_own_account');
  
  if (deleteError) {
    // If RPC doesn't exist, we fallback to event queue for async deletion
    const { error: qError } = await supabase.from('event_queue').insert({
      type: 'user.delete_requested',
      payload: { user_id: user.id },
      source: 'user_action'
    });
    if (qError) {
       return NextResponse.json({ error: 'Failed to process deletion request' }, { status: 500 });
    }
  }

  // Sign out
  await supabase.auth.signOut();
  return response;
}
