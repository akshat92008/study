import { generateDailyPlan, generateMorningBriefing } from '@/lib/ai/agents/planner';
import { syncStudentModel } from '@/lib/engines/inference-engine';
import { logger } from '@/lib/utils/logger';
import { generateJSON, getEmbedding } from '@/lib/ai/gemini';
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

async function processOneUser(userId: string, supabase: any, today: string): Promise<void> {
  // Reset streak if user was not active yesterday
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  const { data: userProfile } = await supabase.from('profiles')
    .select('last_active_at, streak_days')
    .eq('id', userId)
    .single();

  if (userProfile?.last_active_at) {
    const lastActiveDate = new Date(userProfile.last_active_at).toISOString().split('T')[0];
    // If last active was NOT yesterday and NOT today, streak should reset
    if (lastActiveDate !== yesterdayStr && lastActiveDate !== today && (userProfile.streak_days || 0) > 0) {
      await supabase.from('profiles')
        .update({ streak_days: 0 })
        .eq('id', userId);
      logger.info(`Streak reset for user ${userId}. Last active: ${lastActiveDate}`);
    }
  }

  // Generate the new daily mission
  await generateDailyPlan(userId, today);
  // Sync the behavioral inference model
  await syncStudentModel(userId);
  // Synthesize episodic memories from yesterday's events
  await synthesizeMemories(userId, supabase);

  // =====================================================================
  // TASK 3.3: GENERATE & INJECT MORNING BRIEFING TO GLOBAL CHAT
  // =====================================================================
  try {
    // 1. Get or create the Global Chat session for this user
    let { data: session } = await supabase
      .from('chat_sessions')
      .select('id')
      .eq('user_id', userId)
      .eq('session_type', 'global')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!session) {
      const { data: newSession } = await supabase
        .from('chat_sessions')
        .insert({ user_id: userId, session_type: 'global', title: 'Cognition OS Main Thread' })
        .select('id').single();
      session = newSession;
    }

    if (session) {
      // 2. Idempotency Check: Did we already brief them today?
      const { data: existingBriefing } = await supabase
        .from('chat_messages')
        .select('id')
        .eq('session_id', session.id)
        .eq('metadata->>type', 'morning_briefing')
        .eq('metadata->>date', today)
        .maybeSingle();

      if (!existingBriefing) {
        // 3. Generate the narrative via Gemini (from lib/ai/agents/planner.ts)
        const narrative = await generateMorningBriefing(userId);

        // 4. Inject as an Assistant message into the chat
        await supabase.from('chat_messages').insert({
          session_id: session.id,
          user_id: userId,
          role: 'assistant',
          content: narrative,
          metadata: { type: 'morning_briefing', date: today }
        });
        logger.info(`Morning briefing injected into Global Chat for user ${userId}`);
      }
    }
  } catch (briefingErr) {
    logger.warn(`Failed to generate morning briefing for user ${userId}`, briefingErr);
  }

  // Write daily performance snapshot
  try {
    const todayDateStr = new Date().toISOString().split('T')[0];

    // Fetch today's task completion
    const { data: tasks } = await supabase.from('study_tasks')
      .select('is_completed, subject')
      .eq('user_id', userId)
      .gte('scheduled_date', `${todayDateStr}T00:00:00Z`)
      .lte('scheduled_date', `${todayDateStr}T23:59:59Z`);

    const completed = (tasks || []).filter((t: any) => t.is_completed).length;

    // Fetch overall mastery
    const { data: conceptsData } = await supabase.from('concepts')
      .select('mastery')
      .eq('user_id', userId);

    const masteredCount = (conceptsData || []).filter((c: any) =>
      ['proficient', 'mastered', 'automated'].includes(c.mastery)
    ).length;
    const totalCount = (conceptsData || []).length;
    const overallMastery = totalCount > 0 ? masteredCount / totalCount : 0;

    // Fetch accuracy from review logs today
    const { data: reviews } = await supabase.from('review_logs')
      .select('rating')
      .eq('user_id', userId)
      .gte('review', `${todayDateStr}T00:00:00Z`);

    const goodReviews = (reviews || []).filter((r: any) => r.rating >= 3).length;
    const accuracy = reviews && reviews.length > 0 ? goodReviews / reviews.length : 0;

    // Check if snapshot already exists for this user and today's date
    const { data: existingSnapshot } = await supabase.from('performance_snapshots')
      .select('id')
      .eq('user_id', userId)
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
          user_id: userId,
          date: todayDateStr,
          accuracy: accuracy,
          retention_rate: overallMastery,
          concepts_revised: completed,
          created_at: new Date().toISOString(),
        });
    }
  } catch (snapErr) {
    logger.warn(`Snapshot write failed for user ${userId}`, snapErr);
  }
}

const BATCH_SIZE = 10; // Process 10 users concurrently
const DELAY_BETWEEN_BATCHES = 2000; // 2 seconds between batches

async function processUserBatch(userIds: string[], supabase: any, today: string): Promise<void> {
  await Promise.allSettled(
    userIds.map(userId =>
      processOneUser(userId, supabase, today).catch(err =>
        logger.error('Daily synthesis failed for user', { userId, err: err.message })
      )
    )
  );
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

    const userIds = (users || []).map((u: any) => u.id);
    const today = new Date().toISOString().split('T')[0];
    logger.info(`Cron: Starting daily synthesis for ${userIds.length} users targeting date: ${today}`);

    // 4. Process in batches concurrently
    for (let i = 0; i < userIds.length; i += BATCH_SIZE) {
      const batch = userIds.slice(i, i + BATCH_SIZE);
      await processUserBatch(batch, supabase, today);

      if (i + BATCH_SIZE < userIds.length) {
        await new Promise(r => setTimeout(r, DELAY_BETWEEN_BATCHES));
      }
    }
    
    return Response.json({ processed: userIds.length, success: true });
  } catch (globalErr: any) {
    logger.error('Cron: Global execution crash', globalErr);
    return new Response('Internal Server Error', { status: 500 });
  }
}
