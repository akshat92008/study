import { createClient } from '@/lib/supabase/server';
import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { logger } from '@/lib/utils/logger';

export async function GET(req: Request) {
  try {
    // Verify Vercel Cron authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron invocation attempt');
      return new Response('Unauthorized', { status: 401 });
    }

    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    
    // Cron runs as admin to process all users, bypassing RLS
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    // Fetch all active onboarding completed users
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('onboarding_complete', true);

    if (error) {
      logger.error('Cron: Failed to fetch active users', error);
      return new Response('Database Error', { status: 500 });
    }

    const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    logger.info(`Cron: Starting daily synthesis for ${users?.length || 0} users targeting date: ${tomorrow}`);

    for (const user of users || []) {
      try {
        await generateDailyPlan(user.id, tomorrow);
        await syncStudentModel(user.id);
        logger.info(`Cron: Successfully processed synthesis for user ${user.id}`);
      } catch (err: any) {
        logger.error(`Cron: Failed to synthesize for user ${user.id}`, err);
      }
    }
    
    return Response.json({ processed: users?.length || 0 });
  } catch (globalErr: any) {
    logger.error('Cron: Global execution crash', globalErr);
    return new Response('Internal Server Error', { status: 500 });
  }
}
