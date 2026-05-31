import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDueCards, reviewCard } from '@/lib/engines/revision-engine';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

export async function GET(request: NextRequest) {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 120,     // 2 per second sustained
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const userId = user.id;
    const dueCards = await getDueCards(userId);
    return NextResponse.json({ dueCards }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'revision', 'Unable to load revision cards.');
  }
}

// Edit a card (front/back text)
export async function PATCH(request: NextRequest) {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 120,     // 2 per second sustained
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const userId = user.id;
    const body = await request.json();
    const { cardId, front, back } = body;

    if (!cardId) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Card ID is required.',
        requestId,
      });
    }

    // IDOR prevention: ensure the card belongs to this user
    const { data: card } = await supabase
      .from('revision_cards')
      .select('id')
      .eq('id', cardId)
      .eq('user_id', userId)
      .single();

    if (!card) {
      return apiErrorResponse('not_found', {
        status: 404,
        message: 'Card not found.',
        requestId,
      });
    }

    const updates: Record<string, string> = {};
    if (front) updates.front = front;
    if (back) updates.back = back;

    if (Object.keys(updates).length === 0) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'No fields to update.',
        requestId,
      });
    }

    const { error } = await supabase
      .from('revision_cards')
      .update(updates)
      .eq('id', cardId)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'revision', 'Unable to update revision card.');
  }
}

// Delete a card
export async function DELETE(request: NextRequest) {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 120,     // 2 per second sustained
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const userId = user.id;
    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'Card ID is required.',
        requestId,
      });
    }

    // IDOR prevention
    const { error } = await supabase
      .from('revision_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'revision', 'Unable to delete revision card.');
  }
}

// Submit a card review (FSRS rating 1–4)
export async function POST(request: NextRequest) {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 120,     // 2 per second sustained
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const userId = user.id;
    const body = await request.json();
    const { cardId, rating, responseTimeMs } = body;

    if (!cardId || typeof rating !== 'number' || rating < 1 || rating > 4) {
      return apiErrorResponse('invalid_request', {
        status: 400,
        message: 'cardId and rating (1-4) are required.',
        requestId,
      });
    }

    // IDOR prevention: verify ownership before touching the card
    const { data: card } = await supabase
      .from('revision_cards')
      .select('id, user_id')
      .eq('id', cardId)
      .eq('user_id', userId)
      .single();

    if (!card) {
      return apiErrorResponse('not_found', {
        status: 404,
        message: 'Card not found.',
        requestId,
      });
    }

    const result = await reviewCard(cardId, rating as 1 | 2 | 3 | 4, responseTimeMs);
    return NextResponse.json(result, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'revision', 'Unable to review revision card.');
  }
}
