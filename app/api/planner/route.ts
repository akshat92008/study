import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanForDate } from '@/lib/actions/planner';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { date } = body;

    const plan = await getPlanForDate(date || new Date().toISOString().split('T')[0]);
    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error('Planner API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
