import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanForDate } from '@/lib/actions/planner';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { rateLimit } from '@/lib/utils/rate-limit';
import { safeError, logger } from '@/lib/utils/logger';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // 5 planner generations per day per user — expensive multi-step AI call
    if (!await rateLimit(`planner-${user.id}`, 5, 24 * 60 * 60 * 1000)) {
      return NextResponse.json({
        error: 'Daily plan generation limit reached. Your current plan is still active — come back tomorrow.',
      }, { status: 429 });
    }

    const body = await req.json();
    const { date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let plan = await getPlanForDate(targetDate);
    if (!plan || plan.length === 0) {
      plan = await generateDailyPlan(user.id, targetDate);
    }
    
    return NextResponse.json({ plan });
  } catch (error: any) {
    logger.error('Planner route failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
}
