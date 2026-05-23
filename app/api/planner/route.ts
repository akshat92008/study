import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanForDate } from '@/lib/actions/planner';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { safeError, logger } from '@/lib/utils/logger';
import { RateLimiter } from '@/lib/services/rateLimiter';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Rate limit: 5 per 24h
    const limiter = RateLimiter.getInstance();
    const allowed = await limiter.consume(`planner-${user.id}`, 5, 24 * 60 * 60 * 1000);
    if (!allowed) return NextResponse.json({ error: 'Daily limit reached.' }, { status: 429 });

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
