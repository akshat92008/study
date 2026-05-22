import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanForDate } from '@/lib/actions/planner';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { rateLimit } from '@/lib/utils/rate-limit';

export async function POST(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // --- NEW RATE LIMIT ---
    // 5 requests per 24 hours
    if (!await rateLimit(`planner-${user.id}`, 5, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({ error: 'Daily plan generation limit reached.' }, { status: 429 });
    }

    const body = await request.json();
    const { date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let plan = await getPlanForDate(targetDate);
    if (!plan || plan.length === 0) {
      plan = await generateDailyPlan(user.id, targetDate);
    }
    
    return NextResponse.json({ plan });
  } catch (error: any) {
    console.error('Planner API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
