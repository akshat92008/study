import { NextRequest, NextResponse } from 'next/server';
import { validateCronRequest } from '@/lib/middleware/cronAuth';
import { EventWorkerService } from '@/lib/events/worker';

export const maxDuration = 60;
export const GET = POST;

export async function POST(req: NextRequest) {
  const authError = validateCronRequest(req);
  if (authError) return authError;

  const processed = await EventWorkerService.processBatch(50, 5);
  return NextResponse.json({ processed });
}
