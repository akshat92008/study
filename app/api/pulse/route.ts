import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { PulseService } from '@/services/pulse.service';
import { withRateLimit } from '@/lib/middleware/withRateLimit';

export const GET = withRateLimit('pulse', async (req, userId) => {
  const pulse = new PulseService();
  const state = await pulse.getPulseState(userId);
  return NextResponse.json(state);
});
