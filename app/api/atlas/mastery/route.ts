import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSyllabusMastery } from '@/lib/services/atlasService';
import { withRateLimit } from '@/lib/middleware/withRateLimit';

export const GET = withRateLimit('atlas', async (req, userId) => {
  const mastery = await getSyllabusMastery(userId);
  if (!mastery) return NextResponse.json({ error: 'No syllabus data' }, { status: 404 });

  return NextResponse.json(mastery);
});
