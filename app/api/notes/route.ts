import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { safeError, logger } from '@/lib/utils/logger';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const goalId = url.searchParams.get('goalId');

    let query = supabase
      .from('saved_notes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data: notes, error } = await query;
    if (error) throw error;

    return NextResponse.json({ success: true, notes });
  } catch (error: any) {
    logger.error('Failed to fetch notes', { error: safeError(error) });
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { content, goalId } = body;

    if (!content?.trim()) {
      return NextResponse.json({ error: 'Content is required' }, { status: 400 });
    }

    const { data: note, error } = await supabase
      .from('saved_notes')
      .insert({
        user_id: user.id,
        content: content.trim(),
        goal_id: goalId || null
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, note });
  } catch (error: any) {
    logger.error('Failed to save note', { error: safeError(error) });
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const url = new URL(req.url);
    const noteId = url.searchParams.get('id');

    if (!noteId) {
      return NextResponse.json({ error: 'Note ID is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('saved_notes')
      .delete()
      .eq('id', noteId)
      .eq('user_id', user.id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    logger.error('Failed to delete note', { error: safeError(error) });
    return NextResponse.json({ error: safeError(error) }, { status: 500 });
  }
}
