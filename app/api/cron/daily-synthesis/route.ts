import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 300; // Vercel max execution time (5 mins)

export async function GET(req: Request) {
  try {
    // 1. Verify Vercel Cron authorization header
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      logger.warn('Unauthorized cron invocation attempt');
      return new Response('Unauthorized', { status: 401 });
    }

    // 2. We use the service_role key to bypass RLS for background jobs
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 3. Fetch all active users who have completed onboarding
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('onboarding_complete', true);

    if (error) throw error;

    const today = new Date().toISOString().split('T')[0];
    logger.info(`Cron: Starting daily synthesis for ${users?.length || 0} users targeting date: ${today}`);

    // 4. Process each user
    let successCount = 0;
    for (const user of users || []) {
      try {
        // Generate the new daily mission
        await generateDailyPlan(user.id, today);
        // Sync the behavioral inference model
        await syncStudentModel(user.id);
        successCount++;
      } catch (err: any) {
        logger.error(`Cron: Failed to synthesize for user ${user.id}`, err);
      }
    }
    
    return Response.json({ processed: users?.length || 0, successful: successCount });
  } catch (globalErr: any) {
    logger.error('Cron: Global execution crash', globalErr);
    return new Response('Internal Server Error', { status: 500 });
  }
}
