import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { apiErrorResponse, getRequestId, unexpectedApiErrorResponse } from '@/lib/api/errors';
import { retrieveRagContext } from '@/lib/rag/retrieval';

const QuerySchema = z.object({
  query: z.string().min(2),
  materialIds: z.array(z.string().uuid()).optional(),
  subject: z.string().optional(),
  chapter: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const requestId = getRequestId(req);
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiErrorResponse('unauthorized', { status: 401, message: 'Authentication is required.', requestId });

    const parsed = QuerySchema.safeParse(await req.json());
    if (!parsed.success) {
      return apiErrorResponse('invalid_request', { status: 400, message: 'Invalid material query payload.', requestId });
    }

    const context = await retrieveRagContext({
      userId: user.id,
      query: parsed.data.query,
      materialIds: parsed.data.materialIds,
      subject: parsed.data.subject,
      chapter: parsed.data.chapter,
      mode: 'explicit',
    });

    return NextResponse.json({ rag: context }, { headers: { 'x-request-id': requestId } });
  } catch (error) {
    return unexpectedApiErrorResponse(req, error, 'materials_query_unhandled', 'Unable to query study materials.');
  }
}
