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
    const limit = Math.min(50, parseInt(searchParams.get('limit') || '15', 10));
    
    // We fetch recent applied or skipped actions to show as feed items.
    const { data, error } = await supabase
      .from('agent_actions')
      .select('id, agent_name, action_type, title, status, reason, target_type, created_at, evidence')
      .eq('user_id', user.id)
      .in('status', ['applied', 'skipped', 'failed'])
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json({ activity: data });
  } catch (error: any) {
    return apiErrorResponse('internal_server_error', { 
      status: 500, 
      message: error.message || 'Failed to fetch agent activity' 
    });
  }
}
