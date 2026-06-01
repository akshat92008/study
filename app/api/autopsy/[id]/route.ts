import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';
import { withRateLimit } from '@/lib/middleware/withRateLimit';

export const GET = withRateLimit('autopsy', async (request, userId, { params }) => {
  const requestId = getRequestId(request);
  const autopsyId = params.id;

  try {
    const supabase = await createClient();

    const { data: autopsy, error: autopsyError } = await supabase
      .from('mock_autopsies')
      .select('*')
      .eq('id', autopsyId)
      .eq('user_id', userId)
      .single();

    if (autopsyError || !autopsy) {
      return apiErrorResponse('not_found', { status: 404, message: 'Autopsy not found' });
    }

    const { data: questions, error: questionsError } = await supabase
      .from('autopsy_questions')
      .select('*')
      .eq('autopsy_id', autopsyId)
      .order('question_number', { ascending: true });

    if (questionsError) {
      return apiErrorResponse('internal_error', { status: 500, message: 'Failed to fetch questions' });
    }

    return NextResponse.json({ autopsy, questions });
  } catch (error) {
    return apiErrorResponse('internal_error', { status: 500, message: String(error) });
  }
});
