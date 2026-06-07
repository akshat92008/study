import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { runCognitionAgentTurn } from '@/lib/agent/runtime';
import { logger } from '@/lib/utils/logger';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const supabase = createAdminClient();
  const searchParams = new URL(req.url).searchParams;
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') || 50)));
  const batchSize = Math.max(1, Math.min(20, Number(searchParams.get('batchSize') || 10)));

  // Find users with due cards who were recently active (within 14 days)
  const recentActiveSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

  const { data: usersWithDueCards, error } = await supabase
    .from('revision_cards')
    .select('user_id')
    .lte('due', new Date().toISOString())
    .gte('last_reviewed_at', recentActiveSince)
    .limit(limit);

  if (error) {
    logger.error('Background review failed to load users with due cards', { error: error.message });
    return NextResponse.json({ error: 'background_review_user_load_failed' }, { status: 500 });
  }

  const uniqueUserIds = [...new Set((usersWithDueCards ?? []).map((r: any) => r.user_id))];

  if (uniqueUserIds.length === 0) {
    return NextResponse.json({ ok: true, processed: 0, message: 'No users with due cards' });
  }

  // Process in batches to avoid overwhelming the system
  const results: Array<{ userId: string; success: boolean; cardsProcessed: number; error?: string }> = [];

  for (let i = 0; i < uniqueUserIds.length; i += batchSize) {
    const batch = uniqueUserIds.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (userId) => {
        try {
          // Get due cards for this user (limit 50 for payload size)
          const { data: dueCards } = await supabase
            .from('revision_cards')
            .select('id, concept_id, concept_name, subject, chapter, due, state, stability, difficulty, ease_factor, front, back')
            .eq('user_id', userId)
            .lte('due', new Date().toISOString())
            .order('due', { ascending: true })
            .limit(50);

          const cards = dueCards ?? [];

          const loopResult = await runCognitionAgentTurn({
            userId,
            channel: 'background',
            goalId: undefined,
            payload: {
              type: 'background_review',
              cardIds: cards.map((c: any) => c.id),
              cards: cards.map((c: any) => ({
                id: c.id,
                conceptId: c.concept_id,
                conceptName: c.concept_name,
                subject: c.subject,
                chapter: c.chapter,
                due: c.due,
                state: c.state,
                stability: c.stability,
                difficulty: c.difficulty,
                easeFactor: c.ease_factor,
              })),
              cardCount: cards.length,
              source: 'daily_background_review',
            },
            sessionId: undefined,
          }, { supabase: supabase as any });

          logger.info('Background review agent runtime completed', {
            userId,
            cardsProcessed: cards.length,
            changed: loopResult?.mutationSummary?.changed,
            conceptsUpdated: loopResult?.mutationSummary?.conceptsUpdated,
            revisionCardsUpdated: loopResult?.mutationSummary?.revisionCardsCreated,
          });

          return { userId, success: true, cardsProcessed: cards.length };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.warn('Background review user failed', { userId, error: message });
          return { userId, success: false, cardsProcessed: 0, error: message };
        }
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        results.push({
          userId: 'unknown',
          success: false,
          cardsProcessed: 0,
          error: result.reason?.message ?? 'Batch processing failed',
        });
      }
    }
  }

  const succeeded = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  logger.info('Daily background review complete', { total: uniqueUserIds.length, succeeded, failed });

  return NextResponse.json({
    ok: failed === 0,
    processed: uniqueUserIds.length,
    succeeded,
    failed,
    results: results.slice(0, 20), // First 20 for audit trail
    truncated: results.length > 20,
  });
}