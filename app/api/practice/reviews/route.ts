import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';
import { PracticeService } from '@/lib/services/practice.service';
import { logger } from '@/lib/utils/logger';

const ReviewsSchema = z.object({
  messageId: z.string().optional(),
  practiceSetId: z.string().optional(),
  idempotencyKey: z.string().optional(),
  reviews: z.array(z.object({
    position: z.number().int().positive(),
    confidence: z.enum(['easy', 'medium', 'hard', 'forgot', 'again', 'knew'])
  }))
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication required', requestId });
    }

    const body = await req.json();
    const parsed = ReviewsSchema.safeParse(body);
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid payload', requestId });
    }

    const { messageId, practiceSetId, reviews } = parsed.data;

    if (!practiceSetId && !messageId) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Either practiceSetId or messageId is required', requestId });
    }

    // Resolve practice set
    let set;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    
    if (practiceSetId) {
      const { data } = await supabase.from('practice_sets').select('*').eq('id', practiceSetId).eq('user_id', user.id).single();
      set = data;
    } else if (messageId && UUID_RE.test(messageId)) {
      // Look up by messageId first
      const { data } = await supabase
        .from('practice_sets')
        .select('*')
        .eq('message_id', messageId!)
        .eq('set_type', 'flashcard')
        .eq('user_id', user.id)
        .maybeSingle();
      set = data;

      // Phase 2 fix: If practice_set doesn't exist yet (background worker hasn't run),
      // attempt lazy on-demand creation from the assistant message content.
      if (!set && messageId) {
        const { data: msgRow } = await supabase
          .from('chat_messages')
          .select('content, session_id, metadata')
          .eq('id', messageId)
          .eq('user_id', user.id)
          .maybeSingle();

        if (msgRow?.content) {
          // Extract session's goal if available
          let goalId: string | null = null;
          if (msgRow.session_id) {
            const { data: sessionRow } = await supabase
              .from('chat_sessions')
              .select('goal_id')
              .eq('id', msgRow.session_id)
              .maybeSingle();
            goalId = sessionRow?.goal_id ?? null;
          }

          // Try to create practice set on-demand (lazy creation)
          const extraction = await PracticeService.extractAndStorePracticeArtifacts(supabase as any, {
            userId: user.id,
            chatSessionId: msgRow.session_id,
            goalId,
            messageId,
            fullResponse: msgRow.content,
            source: 'mind',
          });

          if (extraction.flashcardSetIds.length > 0) {
            // Re-query the newly created set
            const { data: newSet } = await supabase
              .from('practice_sets')
              .select('*')
              .eq('id', extraction.flashcardSetIds[0])
              .eq('user_id', user.id)
              .single();
            set = newSet;
          }
        }
      }
    }

    if (!set) {
      // Practice set not found and could not be created on-demand.
      // This can happen if the message had no flashcard artifact, or the message doesn't exist.
      return apiErrorResponse('not_found', {
        status: 404,
        message: 'Practice set not found. The flashcard session may not have been saved correctly — please generate a new set.',
        requestId
      });
    }

    // Fetch items
    const positions = reviews.map(r => r.position);
    const { data: items } = await supabase
      .from('practice_items')
      .select('id, concept_id, concept_name, position')
      .eq('practice_set_id', set.id)
      .in('position', positions);

    if (!items || items.length === 0) {
      return apiErrorResponse('not_found', { status: 404, message: 'Practice items not found', requestId });
    }

    let reviewedCount = 0;
    const eventItems: any[] = [];

    const attemptsToInsert = reviews.map(rev => {
      const item = items.find(i => i.position === rev.position);
      if (!item) return null;

      reviewedCount++;

      eventItems.push({
        practiceItemId: item.id,
        conceptId: item.concept_id,
        conceptName: item.concept_name,
        confidence: rev.confidence,
      });

      return {
        user_id: user.id,
        practice_set_id: set.id,
        practice_item_id: item.id,
        confidence: rev.confidence,
        idempotency_key: parsed.data.idempotencyKey ? `${parsed.data.idempotencyKey}:${item.id}` : undefined
      };
    }).filter(a => a !== null);

    if (attemptsToInsert.length === 0) {
      return apiErrorResponse('not_found', { status: 404, message: 'No matching practice items for the given positions', requestId });
    }

    const { error: insertError } = await supabase.from('practice_attempts').upsert(attemptsToInsert, { onConflict: 'user_id, idempotency_key' });
    if (insertError) {
      throw insertError;
    }

    // Prepare metrics for sync
    let correctCount = 0;
    let wrongCount = 0;
    const wrongConceptIds: string[] = [];
    const wrongConceptNames: string[] = [];

    for (const item of eventItems) {
      if (['forgot', 'again', 'hard'].includes(item.confidence)) {
        wrongCount++;
        if (item.conceptId) wrongConceptIds.push(item.conceptId);
        if (item.conceptName) wrongConceptNames.push(item.conceptName);
      } else {
        correctCount++;
      }
    }

    const { syncStudyProfileAfterPracticeAttempt } = await import('@/lib/services/study-profile-sync.service');
    const profileSync = await syncStudyProfileAfterPracticeAttempt(supabase, {
      userId: user.id,
      goalId: set.goal_id ?? null,
      practiceSetId: set.id,
      metrics: {
        correctCount,
        wrongCount,
        wrongConceptIds,
        wrongConceptNames,
      },
      items: eventItems,
    }).catch((error) => {
      logger.error('Failed to sync profile after review', error);
      return { error: 'profile_sync_failed' };
    });

    await EventDispatcher.publish({
      user_id: user.id,
      type: 'PRACTICE_ATTEMPT_RECORDED',
      data: {
        practiceSetId: set.id,
        setType: 'flashcard',
        metrics: {
          reviewedCount
        },
        items: eventItems
      },
      metadata: { source: 'mind_chat_flashcard' },
      idempotency_key: `practice_review:${set.id}:${eventItems.map((item) => `${item.practiceItemId}:${item.confidence}`).sort().join('|')}`
    });

    return NextResponse.json({
      success: true,
      metrics: { reviewedCount },
      practiceSetId: set.id,
      profileSync,
    });
  } catch (error) {
    const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
    return unexpectedApiErrorResponse(req, error, 'practice_review_unhandled');
  }
}
