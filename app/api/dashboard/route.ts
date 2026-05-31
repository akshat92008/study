import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getCognitionData } from '@/lib/actions/cognition';
import { getRevisionData } from '@/lib/actions/revision';
import { getMistakeData } from '@/lib/actions/mistakes';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const requestId = getRequestId(request);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return apiErrorResponse('unauthorized', {
        status: 401,
        message: 'Authentication is required.',
        requestId,
      });
    }

    const [profileRes, cognition, revision, mistakes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      getCognitionData(),
      getRevisionData(),
      getMistakeData(),
    ]);

    return NextResponse.json({
      profile: profileRes.data,
      cognition,
      revision,
      mistakes,
      tasks: [],
    }, { headers: { 'x-request-id': requestId } });
  } catch (error: any) {
    return unexpectedApiErrorResponse(request, error, 'dashboard', 'Unable to load dashboard data.');
  }
}
