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

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== 'DELETE MY ACCOUNT') {
    return NextResponse.json({
      error: 'confirmation_required',
      message: 'Type DELETE MY ACCOUNT to confirm this request.',
    }, { status: 400 });
  }

  // To securely delete an account from the client, they can call an RPC function or we handle it via admin
  // For security, an RPC function `delete_own_account` is preferred.
  const { error: deleteError } = await supabase.rpc('delete_own_account');
  
  if (deleteError) {
    const { error: requestError } = await supabase.from('account_deletion_requests').upsert({
      user_id: user.id,
      status: 'pending',
      requested_at: new Date().toISOString(),
      metadata: { rpcError: deleteError.message, source: 'settings' },
    }, { onConflict: 'user_id' });
    if (requestError) {
       return NextResponse.json({ error: 'Failed to record deletion request' }, { status: 500 });
    }
  }

  // Sign out
  await supabase.auth.signOut();
  return response;
}
