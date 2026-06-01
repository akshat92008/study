import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { EventDispatcher } from '@/lib/events/orchestrator';

const ReviewsSchema = z.object({
  messageId: z.string().optional(),
  practiceSetId: z.string().optional(),
  reviews: z.array(z.object({
    position: z.number().int().positive(),
    confidence: z.enum(['easy', 'medium', 'hard', 'forgot', 'knew'])
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
    if (practiceSetId) {
      const { data } = await supabase.from('practice_sets').select('*').eq('id', practiceSetId).eq('user_id', user.id).single();
      set = data;
    } else {
      const { data } = await supabase.from('practice_sets').select('*').eq('message_id', messageId).eq('set_type', 'flashcard').eq('user_id', user.id).single();
      set = data;
    }

    if (!set) {
      return apiErrorResponse('not_found', { status: 404, message: 'Practice set not found', requestId });
    }

    // Fetch items
    const positions = reviews.map(r => r.position);
    const { data: items } = await supabase.from('practice_items').select('id, concept_id, concept_name, position').eq('practice_set_id', set.id).in('position', positions);
    if (!items) {
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
        confidence: rev.confidence
      };
    }).filter(a => a !== null);

    const { error: insertError } = await supabase.from('practice_attempts').insert(attemptsToInsert);
    if (insertError) {
      throw insertError;
    }

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
      idempotency_key: `practice_review:${set.id}:${Date.now()}`
    });

    return NextResponse.json({
      success: true,
      metrics: { reviewedCount }
    });
  } catch (error) {
    const { unexpectedApiErrorResponse } = await import('@/lib/api/errors');
    return unexpectedApiErrorResponse(req, error, 'practice_review_unhandled');
  }
}
