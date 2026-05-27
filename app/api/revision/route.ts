import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getDueCards, reviewCard } from '@/lib/engines/revision-engine';
import { checkRateLimit, rateLimitResponse } from '@/lib/middleware/rateLimit';

export async function GET(request: Request) {
  try {
    const supabase = createClient();
    const { data: { user }, error: authError } = await (await supabase).auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 60,
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const dueCards = await getDueCards(user.id);
    return NextResponse.json({ dueCards });
  } catch (error: any) {
    console.error('Revision API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Edit a card (front/back text)
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 60,
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const body = await request.json();
    const { cardId, front, back } = body;

    if (!cardId) return NextResponse.json({ error: 'Card ID required' }, { status: 400 });

    // IDOR prevention: ensure the card belongs to this user
    const { data: card } = await supabase
      .from('revision_cards')
      .select('id')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });

    const updates: Record<string, string> = {};
    if (front) updates.front = front;
    if (back) updates.back = back;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const { error } = await supabase
      .from('revision_cards')
      .update(updates)
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Revision PATCH Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Delete a card
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 60,
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const { searchParams } = new URL(request.url);
    const cardId = searchParams.get('cardId');

    if (!cardId) return NextResponse.json({ error: 'Card ID required' }, { status: 400 });

    // IDOR prevention
    const { error } = await supabase
      .from('revision_cards')
      .delete()
      .eq('id', cardId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Revision DELETE Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Submit a card review (FSRS rating 1–4)
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { allowed, remaining, resetAt } = await checkRateLimit({
      identifier: user.id,
      bucket: 'revision',
      maxTokens: 60,
      windowSeconds: 60,
    });
    if (!allowed) return rateLimitResponse(remaining, resetAt);

    const body = await request.json();
    const { cardId, rating, responseTimeMs } = body;

    if (!cardId || typeof rating !== 'number' || rating < 1 || rating > 4) {
      return NextResponse.json(
        { error: 'cardId (string) and rating (1–4) are required' },
        { status: 400 }
      );
    }

    // IDOR prevention: verify ownership before touching the card
    const { data: card } = await supabase
      .from('revision_cards')
      .select('id, user_id')
      .eq('id', cardId)
      .eq('user_id', user.id)
      .single();

    if (!card) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    const result = await reviewCard(cardId, rating as 1 | 2 | 3 | 4, responseTimeMs);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Revision POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
