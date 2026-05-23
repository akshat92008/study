// app/api/cron/cleanup/route.ts
// Runs weekly Sunday 3am UTC.

import { NextResponse, NextRequest } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { validateCronSecret } from '@/lib/utils/cron-auth';

export async function GET(req: NextRequest) {
  const authError = validateCronSecret(req);
  if (authError) return authError;
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    const [rl, ev] = await Promise.all([
      supabase.from('rate_limit_log').delete({ count: 'exact' }).lt('created_at', sevenDaysAgo),
      supabase.from('student_events').delete({ count: 'exact' }).eq('status', 'completed').lt('created_at', thirtyDaysAgo),
    ]);

    logger.info('Cleanup done', { rateLimitRows: rl.count, eventRows: ev.count });
    return NextResponse.json({ rateLimitDeleted: rl.count, eventsDeleted: ev.count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
