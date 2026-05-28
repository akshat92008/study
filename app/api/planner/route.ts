import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanForDate } from '@/lib/actions/planner';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { safeError, logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/middleware/withRateLimit';

export const POST = withRateLimit('planner', async (req, userId) => {
  try {
    const supabase = await createClient();

    const body = await req.json();
    const { date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    let plan = await getPlanForDate(targetDate);
    if (!plan || plan.length === 0) {
      plan = await generateDailyPlan(userId, targetDate);
    }
    
    return NextResponse.json({ plan });
  } catch (error: any) {
    logger.error('Planner route failed', error);
    return NextResponse.json(safeError(error), { status: 500 });
  }
});
