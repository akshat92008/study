import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse } from '@/lib/api/errors';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return apiErrorResponse('unauthorized', { status: 401, message: 'Unauthorized' });
    }

    const { status } = await req.json();
    if (!['approved', 'rejected'].includes(status)) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid status' });
    }

    const { data, error } = await supabase
      .from('revision_cards')
      .update({ approval_status: status })
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, card: data });
  } catch (error: any) {
    return apiErrorResponse('internal_server_error', { 
      status: 500, 
      message: error.message || 'Failed to update card status' 
    });
  }
}
