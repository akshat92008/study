import { generateDailyPlan } from '@/lib/ai/agents/planner';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { logger } from '@/lib/utils/logger';
import { generateJSON } from '@/lib/ai/gemini';
import { getEmbedding } from '@/lib/ai/gemini';
import { z } from 'zod';

export const maxDuration = 300; // Vercel max execution time (5 mins)

// Schema for memory synthesis output
const MemorySynthesisSchema = z.object({
  memories: z.array(z.object({
    type: z.enum(['victory', 'struggle', 'turning_point', 'behavioral_quirk']),
    description: z.string(),
    emotional_context: z.string().optional(),
    importance_score: z.number().default(1.0),
  }))
});

// Function to synthesize episodic memories from daily events
async function synthesizeMemories(userId: string, supabase: any) {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStart = new Date(yesterday.setHours(0, 0, 0, 0)).toISOString();
    const yesterdayEnd = new Date(yesterday.setHours(23, 59, 59, 999)).toISOString();

    // Fetch yesterday's events
    const { data: events } = await supabase
      .from('student_events')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd);

    if (!events || events.length === 0) {
      logger.info(`No events found for user ${userId} yesterday, skipping memory synthesis`);
      return;
    }

    // Fetch mock autopsies from yesterday
    const { data: autopsies } = await supabase
      .from('mock_autopsies')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd);

    // Fetch chat messages from yesterday
    const { data: chatMessages } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', yesterdayStart)
      .lte('created_at', yesterdayEnd);

    // Build context for AI
    const eventsSummary = events.map((e: any) => `- ${e.type}: ${JSON.stringify(e.data)}`).join('\n');
    const autopsiesSummary = autopsies?.map((a: any) => `- ${a.test_name}: Score ${a.current_score}/${a.potential_score}, Recoverable: ${a.recoverable_marks}`).join('\n') || 'None';
    const chatSummary = chatMessages?.slice(-10).map((m: any) => `- ${m.role}: ${m.content.substring(0, 100)}...`).join('\n') || 'None';

    const prompt = `
Analyze today's raw study events, mock autopsies, and chat logs for this student.
Extract ONLY highly salient episodic memories. Ignore standard progression.
Look for:
1. "victories" (e.g., Finally mastered a concept they failed 5 times before).
2. "struggles" (e.g., 3 consecutive failures on the same question type).
3. "behavioral_quirks" (e.g., Accuracy drops specifically after 45 minutes).
4. "turning_point" (e.g., Breakthrough moment in understanding).

RAW DATA:
EVENTS:
${eventsSummary}

MOCK AUTOPSIES:
${autopsiesSummary}

CHAT LOGS (last 10):
${chatSummary}

Output JSON array of memories to persist. Maximum 3 memories. Be selective.
`;

    const result = await generateJSON('pro', 'You are the memory synthesis engine of Cognition OS.', prompt, MemorySynthesisSchema);

    if (result.memories && result.memories.length > 0) {
      // Insert memories with embeddings
      for (const memory of result.memories) {
        const embedding = await getEmbedding(memory.description);
        
        await supabase.from('episodic_memories').insert({
          user_id: userId,
          type: memory.type,
          description: memory.description,
          emotional_context: memory.emotional_context || null,
          importance_score: memory.importance_score,
          embedding: embedding,
        });
      }
      
      logger.info(`Synthesized ${result.memories.length} episodic memories for user ${userId}`);
    }
  } catch (err) {
    logger.error(`Failed to synthesize memories for user ${userId}`, err);
  }
}

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
        // Reset streak if user was not active yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: userProfile } = await supabase.from('profiles')
          .select('last_active_at, streak_days')
          .eq('id', user.id)
          .single();

        if (userProfile?.last_active_at) {
          const lastActiveDate = new Date(userProfile.last_active_at).toISOString().split('T')[0];
          // If last active was NOT yesterday and NOT today, streak should reset
          if (lastActiveDate !== yesterdayStr && lastActiveDate !== today && (userProfile.streak_days || 0) > 0) {
            await supabase.from('profiles')
              .update({ streak_days: 0 })
              .eq('id', user.id);
            logger.info(`Streak reset for user ${user.id}. Last active: ${lastActiveDate}`);
          }
        }

        // Generate the new daily mission
        await generateDailyPlan(user.id, today);
        // Sync the behavioral inference model
        await syncStudentModel(user.id);
        // Synthesize episodic memories from yesterday's events
        await synthesizeMemories(user.id, supabase);

        // Write daily performance snapshot
        try {
          const todayDateStr = new Date().toISOString().split('T')[0];

          // Fetch today's task completion
          const { data: tasks } = await supabase.from('study_tasks')
            .select('is_completed, subject')
            .eq('user_id', user.id)
            .gte('scheduled_date', `${todayDateStr}T00:00:00Z`)
            .lte('scheduled_date', `${todayDateStr}T23:59:59Z`);

          const completed = (tasks || []).filter(t => t.is_completed).length;

          // Fetch overall mastery
          const { data: conceptsData } = await supabase.from('concepts')
            .select('mastery')
            .eq('user_id', user.id);

          const masteredCount = (conceptsData || []).filter(c =>
            ['proficient', 'mastered', 'automated'].includes(c.mastery)
          ).length;
          const totalCount = (conceptsData || []).length;
          const overallMastery = totalCount > 0 ? masteredCount / totalCount : 0;

          // Fetch accuracy from review logs today
          const { data: reviews } = await supabase.from('review_logs')
            .select('rating')
            .eq('user_id', user.id)
            .gte('review', `${todayDateStr}T00:00:00Z`);

          const goodReviews = (reviews || []).filter(r => r.rating >= 3).length;
          const accuracy = reviews && reviews.length > 0 ? goodReviews / reviews.length : 0;

          // Check if snapshot already exists for this user and today's date
          const { data: existingSnapshot } = await supabase.from('performance_snapshots')
            .select('id')
            .eq('user_id', user.id)
            .eq('date', todayDateStr)
            .maybeSingle();

          if (existingSnapshot) {
            await supabase.from('performance_snapshots')
              .update({
                accuracy: accuracy,
                retention_rate: overallMastery,
                concepts_revised: completed,
              })
              .eq('id', existingSnapshot.id);
          } else {
            await supabase.from('performance_snapshots')
              .insert({
                user_id: user.id,
                date: todayDateStr,
                accuracy: accuracy,
                retention_rate: overallMastery,
                concepts_revised: completed,
                created_at: new Date().toISOString(),
              });
          }
        } catch (snapErr) {
          logger.warn(`Snapshot write failed for user ${user.id}`, snapErr);
        }

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
