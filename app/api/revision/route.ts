import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDueCards } from '@/lib/engines/revision-engine';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const dueCards = await getDueCards(user.id);
    return NextResponse.json({ dueCards });
  } catch (error: any) {
    console.error('Revision API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
