import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getPlanForDate } from '@/lib/actions/planner';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { safeError, logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/middleware/withRateLimit';

import { z } from 'zod';

const PlannerRequestSchema = z.object({
  date: z.string().optional(),
});

export const POST = withRateLimit('planner', async (req, userId) => {
  try {
    const supabase = await createClient();

    let body;
    try {
      body = PlannerRequestSchema.parse(await req.json());
    } catch (e) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }
    const { date } = body;
    const targetDate = date || new Date().toISOString().split('T')[0];

    const { checkIdempotency } = await import('@/lib/middleware/idempotency');
    const idempotencyKey = req.headers.get('Idempotency-Key');
    const { isDuplicate, error: idempError } = await checkIdempotency(userId, 'planner', idempotencyKey);
    
    if (idempError) return NextResponse.json({ error: idempError }, { status: 400 });
    if (isDuplicate) return NextResponse.json({ error: 'Duplicate request' }, { status: 409 });

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
