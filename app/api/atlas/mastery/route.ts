import { NextResponse } from 'next/server';
import { getSyllabusMastery } from '@/lib/services/atlasService';
import { withRateLimit } from '@/lib/middleware/withRateLimit';
import { apiErrorResponse, getRequestId } from '@/lib/api/errors';

export const GET = withRateLimit('atlas', async (req, userId) => {
  const requestId = getRequestId(req);
  const mastery = await getSyllabusMastery(userId);
  if (!mastery) {
    return apiErrorResponse('not_found', {
      status: 404,
      message: 'No syllabus data found.',
      requestId,
    });
  }

  return NextResponse.json(mastery, { headers: { 'x-request-id': requestId } });
});
