import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'unauthorized', message: 'Authentication is required.' },
      { status: 401 }
    );
  }

  return NextResponse.json(
    {
      error: 'deprecated_route',
      message: 'Use /api/dashboard/complete-session for MVP session completion.',
    },
    { status: 404 }
  );
}
