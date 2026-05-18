import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userMistakes } = await (await supabase).from('mistakes').select('*').eq('user_id', user.id);
    return NextResponse.json({ mistakes: userMistakes || [] });
  } catch (error: any) {
    console.error('Mistakes API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
