import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/api/errors';

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Unauthorized' });
    }

    const { searchParams } = new URL(req.url);
    const goalId = searchParams.get('goalId');
    const status = searchParams.get('status') || 'pending';

    let query = supabase
      .from('revision_cards')
      .select('*')
      .eq('user_id', user.id)
      .eq('approval_status', status);

    if (goalId) {
      query = query.eq('goal_id', goalId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ cards: data });
  } catch (error: any) {
    return apiErrorResponse('internal_server_error', { 
      status: 500, 
      message: error.message || 'Failed to fetch pending cards' 
    });
  }
}
